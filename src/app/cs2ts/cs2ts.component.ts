import { AfterContentInit, Component, ElementRef, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject, takeLast, tap } from 'rxjs';
import { CodeAreaComponent } from '../code-area/code-area.component';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { Meta } from '@angular/platform-browser';

@Component({
  selector: 'app-cs2ts',
  standalone: true,
  imports: [FormsModule, CodeAreaComponent],
  templateUrl: './cs2ts.component.html',
  animations: [
    trigger('valueChangeAnim', [
      transition('* <=> *', [
        animate('0.07s ease-out', style({ "border-color": "limegreen" })),
        animate('0.07s ease-in', style({ "border-color": "var(--bs-border-color)" }))
      ]),
    ])
  ],
  styles: `
  .code-border{
    border: 3px solid var(--bs-border-color);
  }
  `
})
export class Cs2tsComponent implements AfterContentInit {
  protected csCode: string = `public class a : b {
  public int x1 { get; set; }
  public float? x2 { get; set; }
  public string x3 { get; set; }
  public bool[] x8 { get; set; }
  public long[] x9 { get; set; }
  public IEnumerable<string> x10 { get; set; }
}`;
  protected tsCode !: string;
  protected status: boolean = false;

  protected inputDebouncer = new Subject<string>();

  constructor(meta: Meta) {
    meta.addTags([
      { name: "description", content: "Converts C# model to TS model, converts fields, types, arrays and generics." },
      { name: "keywords", content: "C#, TS, CSharp, TypeScript, script, type, generic, array, converter, model, fields, string, number, int, class, code, language, long, float, boolean, bool" },
    ]);
  }

  ngAfterContentInit(): void {
    this.inputDebouncer.pipe(
      debounceTime(500),
      tap(value => this.convert(value)),
      takeLast(1),
    ).subscribe();

    this.convert(this.csCode);
  }

  protected convert(csCode?: string) {
    let code = csCode ? csCode : this.csCode;
    this.tsCode = Cs2tsComponent.convert(code);
    this.status = !this.status;
  }

  private static convert(code: string): string {
    code = code.replace(/public class (?<name>\w+)(?<ext1> : (?<ext2>.+))* \{/gm,
      (match, name, ext1, ext2) => {
        return `export interface ${name} ${ext1 ? "extends " + ext2 : ""} {`;
      });

    code = code.replaceAll(/public (?<type>\w+)(?<gen1><(?<gen2>\w+)(?<arr1>\[\])*>)*(?<arr2>\[\])*(?<nul>\?)* (?<name>\w+) (.*)/gm,
      (match, type, gen1, gen2, arr1, arr2, nul, name) => {
        switch (type) {
          case "List":
          case "IEnumerable":
          case "ICollection":
            arr2 = "[]";
            type = gen2;
            gen1 = undefined;
            gen2 = undefined;
        }

        type = Cs2tsComponent.convertTypes(type);
        gen2 = Cs2tsComponent.convertTypes(gen2);

        return `${name} ${nul ? nul : ""}: ${type}${gen2 ? "<" + gen2 + (arr1 ? arr1 : "") + ">" : ""}${arr2 ? arr2 : ""}${nul ? " | null" : ""} ;`;
      });

    return code;
  }

  private static convertTypes(a: string | undefined): string | undefined {
    if (a === "bool")
      return "boolean";

    switch (a) {
      case "int":
      case "float":
      case "double":
      case "decimal":
      case "long":
        return "number";
    }

    return a;
  }
}
