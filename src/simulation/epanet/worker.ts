import { InitHydOption, Project, Workspace } from "epanet-js";
import { SimulationResult } from "../result";

export const runSimulation = (inp: string): SimulationResult => {
  const ws = new Workspace();
  const model = new Project(ws);

  ws.writeFile("net.inp", inp);

  try {
    model.open("net.inp", "report.rpt", "results.out");
    model.openH();
    model.initH(InitHydOption.SaveAndInit);
    model.runH();

    model.close();

    return {
      status: "success",
      report: ws.readFile("report.rpt"),
    };
  } catch (error) {
    model.copyReport("error.rpt");
    const report = ws.readFile("report.rpt");

    return {
      status: "failure",
      report:
        report.length > 0 ? curateReport(report) : (error as Error).message,
    };
  }
};

const curateReport = (input: string): string => {
  const errorOnlyOncePerLine = /(Error [A-Za-z0-9]+:)(?=.*\1)/g;
  return input.replace(errorOnlyOncePerLine, "");
};
