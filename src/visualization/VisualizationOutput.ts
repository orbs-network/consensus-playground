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
            res += `        {source:{id:'${from}',start:.48,end:.52},target:{id:'${to}',start:.38,end:.62},v:"${messages.activeConnections[from][to]}"},\n`;
          }
        }
      }
      res += "      ],\n";
    }
    return res;
  }

  colorize(v: string) {
    const i = Math.abs(v.split("").reduce(function(a, b) {a = (( a << 5) - a) + b.charCodeAt(0); return a & a; }, 0)) % 19;
    return ["#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4", "#009688", "#4CAF50", "#8BC34A", "#CDDC39", "#FFEB3B", "#FFC107", "#FF9800", "#FF5722", "#795548", "#9E9E9E", "#607D8B"][i];
  }

  @bind
  getRenderedLegend(): string {
    let res = "";
    for (const value in this.statistics.recordedMessageValues) {
      res += `  <div style="opacity: 0.75; background-color: ${this.colorize(value)}; padding: 12px; margin: 12px;">${value}</div>\n`;
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
          <link href="http://cdn.syncfusion.com/16.1.0.24/js/web/flat-azure/ej.web.all.min.css" rel="stylesheet"/>
          <script src="http://cdn.syncfusion.com/js/assets/external/jquery-1.10.2.min.js"></script>
          <script src="http://cdn.syncfusion.com/16.1.0.24/js/web/ej.web.all.min.js"></script>
          <style>
            body {
              font-family: 'Roboto Mono', monospace;
              font-size: 12px;
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
            .frame .e-slider-wrap {
                display: block;
                margin-top: 40px;
            }
          </style>
        </head>
        <body>
          <center>
            <h2>${this.scenarioName}</h2>
            <div id="chart"></div>
            <div id="timestamp"></div>
            <div id="timeSlider" style="margin: 0 auto; width: 50%;"></div>
          </center>
          <div style="position: fixed; left: 30; top: 100;">
            ${this.getRenderedLegend()}
          </div>

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
      var rObj = 0,target;
              $(function() {
                  var initValue = 0;
                  $("#timeSlider").ejSlider({
                      height: 16,
                      value: initValue,
                      minValue: 0,
                      maxValue: ${this.statistics.recordedMessagesByInterval.length - 1},
                      incrementStep: 1,
                      change: "onChange",
                      slide: "onChange"
                  });

                  rObj = $('#timeSlider').data('ejSlider');

              });

              function onChange(args) {
                  this.wrapper.prev().children('span.value').html(args.value);
                  update(args.value);
              }

      function colorize(v) {
        var i = Math.abs(v.split("").reduce(function(a,b){a=((a<<5)-a)+b.charCodeAt(0);return a&a},0)) % 19;
        return ["#F44336","#E91E63","#9C27B0","#673AB7","#3F51B5","#2196F3","#03A9F4","#00BCD4","#009688","#4CAF50","#8BC34A","#CDDC39","#FFEB3B","#FFC107","#FF9800","#FF5722","#795548","#9E9E9E","#607D8B"][i];
      }
      function update(v) {
        if (lastUpdate == v) return;
        lastUpdate = v;
        document.getElementById("timestamp").innerText = (v * ${this.statistics.shouldRecordMessagesByInterval}).toString() + " ms";
        data = dataPoints[v];
        circos.chords("l1", data, {
          radius: 0.5,
          logScale: false,
          opacity: 0.7,
          color: function (datum) { return colorize(datum.v); },
          tooltipContent: function (datum) { return datum.v; },
          events: {}
        }).render();
      }
      update(0);



        </script>
        </body>
       </html>
    `);
  }

}
