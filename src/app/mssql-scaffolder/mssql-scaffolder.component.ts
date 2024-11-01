import { Component } from '@angular/core';
import { CodeAreaComponent } from "../code-area/code-area.component";
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MssqlService } from '../../services/mssql/mssql.service';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { AppComponent } from '../app/app.component';
import { ConnectRequest, ConnectResponse, ErrorResponse, GetAllDatabasesResponse, GetAllSchemasResponse, GetStoredProceduresResponse, GetTablesResponse } from '../../services/mssql/mssql.model';
import { MssqlScaffolderService } from './mssql-scaffolder.service';
import { Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-database-tools',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, CodeAreaComponent],
  templateUrl: './mssql-scaffolder.component.html',
  animations: [
    trigger('connection', [
      state("0", style({ "border-width": "3px", "border-color": "var(--bs-border-color)" })),
      state("1", style({ "border-width": "3px", "border-color": "var(--bs-warning)" })),
      state("2", style({ "border-width": "3px", "border-color": "limegreen" })),
      transition('* <=> *', [
        animate('0.1s ease-in-out'),
      ]),
    ])
  ]
})
export class MssqlScaffoldComponent {
  protected dbSettings: FormGroup = new FormGroup<DbSetting>(
    {
      server: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      username: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    }
  );
  protected scaffoldForm: FormGroup = new FormGroup<ScaffoldForm>(
    {
      database: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
      schema: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
      isTable: new FormControl(true, { nonNullable: true })
    }
  );
  protected status: ConnectionStatus = ConnectionStatus.disconnected;
  protected connectionStatus = ConnectionStatus;
  protected connectionError!: string | null;
  protected csCode: string = "";
  protected isTable: boolean = true;

  protected Dbs!: GetAllDatabasesResponse[];
  protected Schemas!: GetAllSchemasResponse[];
  protected Tables!: GetTablesResponse[];
  protected Sps!: GetStoredProceduresResponse[];

  private connectionID !: string;

  constructor(
    private mssql: MssqlService,
    private scaffolder: MssqlScaffolderService,
    meta: Meta
  ) {
    meta.addTags([
      { name: "description", content: "Scaffolds MSSQL table models and stored procedures input and output models to C# classes." },
      { name: "keywords", content: "C#, MSSQL, CSharp, microsoft, scaffold, db-first, database, model, DTO, class, table, schema, stored procedure, SQL server, code generator" },
    ]);

    this.initForm();
  }

  private initForm() {
    this.scaffoldForm.controls["database"].valueChanges.subscribe(v => {
      if (v.length == 0)
        return;
      this.getSchemas();
      this.scaffoldForm.controls["schema"].enable();
    });
    this.scaffoldForm.controls["schema"].valueChanges.subscribe(v => {
      if (v.length == 0)
        return;
      this.scaffoldForm.controls["isTable"].enable();
      if (this.scaffoldForm.controls["isTable"].value) {
        this.scaffoldForm.controls["table"].enable();
        this.getTables();
      }
      else {
        this.getSPs();
        this.scaffoldForm.controls["sp"].enable();
      }
    });
    this.scaffoldForm.addControl("table", new FormControl("", { nonNullable: true, validators: [Validators.required] }));
    this.scaffoldForm.controls["isTable"].valueChanges.subscribe(v => {
      this.isTable = v;
      if (v) {
        this.getTables();
        this.scaffoldForm.removeControl("sp");
        this.scaffoldForm.addControl("table", new FormControl("", { nonNullable: true, validators: [Validators.required] }));
      } else {
        this.getSPs();
        this.scaffoldForm.removeControl("table");
        this.scaffoldForm.addControl("sp", new FormControl("", { nonNullable: true, validators: [Validators.required] }));
      }
    });
    this.scaffoldForm.disable();
  }

  protected async connect() {
    if (!AppComponent.isBrowser)
      return;

    if (this.status == this.connectionStatus.disconnected) {
      this.status = this.connectionStatus.connecting;
      this.dbSettings.disable();
      this.mssql.connect(this.dbSettings.getRawValue() as ConnectRequest).subscribe({
        next: (res) => {
          res = res as ConnectResponse;
          this.connectionID = res.connection_id;
          this.status = this.connectionStatus.connected;
          this.connectionError = null;
          this.getDBs();
          this.scaffoldForm.controls["database"].enable();
        },
        error: (err) => {
          this.status = this.connectionStatus.disconnected;
          this.dbSettings.enable();
          this.connectionError = (err.error as ErrorResponse).detail;
        }
      });
    } else
      this.mssql.disconnect(this.connectionID).subscribe({
        next: (res) => {
          this.status = this.connectionStatus.disconnected;
          this.dbSettings.enable();
          this.connectionError = null;
          this.scaffoldForm.disable();
        },
        error: (err) => {
          this.connectionError = (err.error as ErrorResponse).detail;
        }
      });
  }

  protected getDBs() {
    this.mssql.getAllDatabases(this.connectionID).subscribe((res) => {
      this.scaffoldForm.reset();
      this.Dbs = res as GetAllDatabasesResponse[];
    });
  }

  protected getSchemas() {
    this.mssql.getAllSchemas(this.connectionID, this.scaffoldForm.controls["database"].value).subscribe((res) => {
      this.Schemas = res as GetAllSchemasResponse[];
      this.scaffoldForm.controls["schema"].enable();
      if (this.scaffoldForm.controls["isTable"]) {
        this.scaffoldForm.controls["table"].reset();
        this.scaffoldForm.controls["table"].disable();
      } else {
        this.scaffoldForm.controls["sp"].reset();
        this.scaffoldForm.controls["sp"].disable();
      }
    });
  }

  protected getTables() {
    this.mssql.getTables(this.connectionID, this.scaffoldForm.controls["database"].value, this.scaffoldForm.controls["schema"].value).subscribe((res) => {
      this.Tables = res as GetTablesResponse[];
      this.scaffoldForm.controls["table"].enable();
    });
  }

  protected getSPs() {
    this.mssql.getStoredProcedures(this.connectionID, this.scaffoldForm.controls["database"].value, this.scaffoldForm.controls["schema"].value).subscribe((res) => {
      this.Sps = res as GetStoredProceduresResponse[];
      this.scaffoldForm.controls["sp"].enable();
    });
  }

  protected scaffold() {
    if (this.scaffoldForm.controls["isTable"]) {

    } else {

    }
  }
}

enum ConnectionStatus {
  disconnected,
  connecting,
  connected
}

interface DbSetting {
  server: AbstractControl<string>;
  username: AbstractControl<string>;
  password: AbstractControl<string>;
}

interface ScaffoldForm {
  database: AbstractControl<string>;
  schema: AbstractControl<string>;
  isTable: AbstractControl<boolean>;
}