import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const taskSeverityData = {
  findMany: (options?: { orderBy?: Prisma.TaskSeverityOrderByWithRelationInput }) =>
    prisma.taskSeverity.findMany(options),

  findUniqueOrThrow: (where: Prisma.TaskSeverityWhereUniqueInput) =>
    prisma.taskSeverity.findUniqueOrThrow({ where }),
};
