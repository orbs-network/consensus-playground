import * as _ from "lodash";
import bind from "bind-decorator";

interface ScenarioData {
  name: string;
  categories: string[];
  algorithms: string[];
  algorithmResults: {[algorithm: string]: {[category: string]: string}};
}

export default class BenchmarkOutput {
  protected html: string = "";
  public currentScenarioData: ScenarioData;

  @bind
  startScenario(name: string): void {
    this.currentScenarioData = {
      name: name,
      categories: [],
      algorithms: [],
      algorithmResults: {}
    };
  }

  @bind
  endScenario(): void {
    this.renderCurrentScenarioData();
  }

  @bind
  addAlgorithm(algorithm: string): void {
    this.currentScenarioData.algorithms.push(algorithm);
    this.currentScenarioData.algorithmResults[algorithm] = {};
  }

  @bind
  addAlgorithmResult(algorithm: string, category: string, value: string): void {
    if (_.indexOf(this.currentScenarioData.categories, category) === -1) {
      this.currentScenarioData.categories.push(category);
    }
    this.currentScenarioData.algorithmResults[algorithm][category] = value;
  }

  @bind
  protected out(html: string): void {
    this.html += html;
  }

  @bind
  get(): string {
    return this.html;
  }

  @bind
  start(): void {
    this.out(`
      <html>
      <head>
        <link href="https://fonts.googleapis.com/css?family=Roboto+Mono:400,700" rel="stylesheet">
        <style>
          body {
            font-family: 'Roboto Mono', monospace;
            font-size: 10px;
          }
          h2 {
            font-size: 16px;
            font-weight: 700;
            color: #45ADA8;
          }
          th {
            font-weight: 700;
            text-align: left;
            color: #45ADA8;
            background-color: #E5FCC2;
          }
          table, th, td {
            border: 1px solid black;
            border-collapse: collapse;
            padding: 5px;
            font-size: 12px;
          }
          tr:nth-child(odd) {
            background-color: #f8f8f8;
          }
          .right {
            text-align: right;
          }
        </style>
      </head>
      <body>
    `);
  }

  @bind
  end(): void {
    this.out(`
      </body>
      </html>
    `);
  }

  @bind
  protected renderCurrentScenarioData(): void {
    this.out(`
      <h2>${this.currentScenarioData.name}</h2>
      <table>
      <tr>
        <th>algorithm</th>
    `);
    for (const category of this.currentScenarioData.categories) {
      this.out(`
        <th>${category}</th>
      `);
    }
    this.out(`
      </tr>
    `);
    for (const algorithm of this.currentScenarioData.algorithms) {
      this.out(`
        <tr>
          <td>${algorithm}</td>
      `);
      for (const category of this.currentScenarioData.categories) {
        this.out(`
          <td class="right">${this.currentScenarioData.algorithmResults[algorithm][category]}</td>
        `);
      }
      this.out(`
        </tr>
      `);
    }
    this.out(`
      </table>
    `);
  }

}
