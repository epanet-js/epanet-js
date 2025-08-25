import { CustomerPoint } from "./customer-points";

export class CustomerPointsLookup {
  private lookup: Map<string, Set<CustomerPoint>> = new Map();

  addConnection(customerPoint: CustomerPoint): void {
    const connection = customerPoint.connection;
    if (!connection) return;

    if (connection.junctionId) {
      if (!this.lookup.has(connection.junctionId)) {
        this.lookup.set(connection.junctionId, new Set());
      }
      this.lookup.get(connection.junctionId)!.add(customerPoint);
    }

    if (connection.pipeId) {
      if (!this.lookup.has(connection.pipeId)) {
        this.lookup.set(connection.pipeId, new Set());
      }
      this.lookup.get(connection.pipeId)!.add(customerPoint);
    }
  }

  removeConnection(customerPoint: CustomerPoint): void {
    const connection = customerPoint.connection;
    if (!connection) return;

    if (connection.junctionId) {
      const junctionSet = this.lookup.get(connection.junctionId);
      if (junctionSet) {
        junctionSet.delete(customerPoint);
        if (junctionSet.size === 0) {
          this.lookup.delete(connection.junctionId);
        }
      }
    }

    if (connection.pipeId) {
      const pipeSet = this.lookup.get(connection.pipeId);
      if (pipeSet) {
        pipeSet.delete(customerPoint);
        if (pipeSet.size === 0) {
          this.lookup.delete(connection.pipeId);
        }
      }
    }
  }

  getCustomerPoints(assetId: string): Set<CustomerPoint> {
    return this.lookup.get(assetId) || new Set();
  }

  hasConnections(assetId: string): boolean {
    return this.lookup.has(assetId);
  }

  clear(): void {
    this.lookup.clear();
  }

  copy(): CustomerPointsLookup {
    const newLookup = new CustomerPointsLookup();
    for (const [, customerPointsSet] of this.lookup.entries()) {
      for (const customerPoint of customerPointsSet) {
        newLookup.addConnection(customerPoint);
      }
    }
    return newLookup;
  }

  entries(): IterableIterator<[string, Set<CustomerPoint>]> {
    return this.lookup.entries();
  }
}
