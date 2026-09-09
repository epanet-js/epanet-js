import {
  WHOLE_VALUE,
  type Cell,
  type ChangeRecord,
  type EntityKind,
} from "@epanet-js/change-set";
import { schemaForField } from "@epanet-js/model-schema";

const describe = (entity: EntityKind, id: number | string, field: string) =>
  `${entity} ${id}: ${field}`;

const checkBag = (
  entity: EntityKind,
  id: number | string,
  bag: ChangeRecord["before"],
): void => {
  for (const field in bag) {
    const cell = bag[field];
    if (cell === undefined) continue;

    const schema = schemaForField(entity, field);
    if (!schema) {
      throw new Error(`${describe(entity, id, field)} has no schema`);
    }

    const result = schema.safeParse(cell);
    if (!result.success) {
      throw new Error(
        `${describe(entity, id, field)} is not valid — ${result.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
    }

    if (field === WHOLE_VALUE) bag[field] = result.data as Cell;
  }
};

export const validateRecords = (records: readonly ChangeRecord[]): void => {
  for (const record of records) {
    checkBag(record.entity, record.id, record.before);
    checkBag(record.entity, record.id, record.after);
  }
};
