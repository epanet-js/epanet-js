import { Project, Workspace } from "epanet-js";

export type SimulationResult = {
  status: "success" | "failure";
  report: string;
};

export const runSimulation = (inp: string): SimulationResult => {
  const ws = new Workspace();
  const model = new Project(ws);

  try {
    ws.writeFile("net.inp", inp);
    model.open("net.inp", "report.rpt", "results.out");
    model.solveH();

    model.close();

    return {
      status: "success",
      report: ws.readFile("report.rpt"),
    };
  } catch (error) {
    const report = ws.readFile("report.rpt");
    return {
      status: "failure",
      report: report.length > 0 ? report : (error as Error).message,
    };
  }
};
