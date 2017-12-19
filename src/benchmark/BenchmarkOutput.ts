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
  protected currentScenarioData: ScenarioData;

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
          <td>${this.currentScenarioData.algorithmResults[algorithm][category]}</td>
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
