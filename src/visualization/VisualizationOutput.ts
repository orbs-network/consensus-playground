import * as _ from "lodash";
import Statistics from "../simulation/Statistics";
import bind from "bind-decorator";

export default class VisualizationOutput {
  protected html: string = "";
  protected numNodes: number;
  protected statistics: Statistics;
  protected scenarioName: string;

  constructor(numNodes: number, statistics: Statistics, scenarioName: string) {
    this.numNodes = numNodes;
    this.statistics = statistics;
    this.scenarioName = scenarioName;
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
  getRenderedLabels(): string {
    let res = "";
    for (let i = 1; i <= this.numNodes; i++) {
      res += `      { len: 1, color: "#8dd3c7", label: "${i}", id: "${i}" },\n`;
    }
    return res;
  }

  @bind
  getRenderedDataPoints(): string {
    let res = "";
    for (let i = 0; i < this.statistics.recordedMessagesByInterval.length; i++) {
      res += "      [\n";
      const messages = this.statistics.recordedMessagesByInterval[i];
      if (messages) {
        for (const from in messages.activeConnections) {
          for (const to in messages.activeConnections[from]) {
            res += `        {source:{id:'${from}',start:.48,end:.52},target:{id:'${to}',start:.38,end:.62}},\n`;
          }
        }
      }
      res += "      ],\n";
    }
    return res;
  }

  @bind
  render(): void {
    this.out(`
      <html>
        <head>
          <script src="https://d3js.org/d3.v4.min.js"></script>
          <script src="https://cdn.rawgit.com/nicgirault/circosJS/v2/dist/circos.js"></script>
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
            #timestamp {
              font-size: 22px;
              font-weight: 700;
              color: #ccc;
            }
          </style>
        </head>
        <body>
          <center>
            <h2>${this.scenarioName}</h2>
            <div id="chart"></div>
            <input type="range" name="points" min="0" max="${this.statistics.recordedMessagesByInterval.length - 1}" step="1" value="0" id="slider-time" style="width:900px">
            <div id="timestamp"></div>
          </center>
        <script>

      var labels = [
${this.getRenderedLabels()}
      ];

      var dataPoints = [
${this.getRenderedDataPoints()}
      ];

      var width = 670;
      var circos = new Circos({
        container: "#chart",
        width: width,
        height: width
      });
      var data;
      circos.layout(labels, {
        innerRadius: width/2 - 50,
        outerRadius: width/2 - 20,
        cornerRadius: 20,
        gap: 0.20,
        labels: {
          radialOffset: 10
        },
        ticks: {
          display: false
        }
      }).render();
      var lastUpdate = -1;
      function update(v) {
        if (lastUpdate == v) return;
        lastUpdate = v;
        document.getElementById("timestamp").innerText = (v * ${this.statistics.shouldRecordMessagesByInterval}).toString() + " ms";
        data = dataPoints[v];
        circos.chords("l1", data, {
          radius: 0.5,
          logScale: false,
          opacity: 0.7,
          color: "#ff5722",
          events: {}
        }).render();
      }
      update(0);
      d3.select("#slider-time").on("mousemove", function() {
        update(parseInt(this.value));
      });

        </script>
        </body>
       </html>
    `);
  }

}
