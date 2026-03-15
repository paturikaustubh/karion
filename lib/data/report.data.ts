import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const reportData = {
  find: (where: Prisma.ReportWhereInput) =>
    prisma.report.findFirst({ where }),

  findMany: (
    where: Prisma.ReportWhereInput,
    options?: { orderBy?: Prisma.ReportOrderByWithRelationInput; take?: number }
  ) => prisma.report.findMany({ where, ...options }),

  upsert: (
    where: Prisma.ReportWhereUniqueInput,
    create: Prisma.ReportCreateInput,
    update: Prisma.ReportUpdateInput
  ) => prisma.report.upsert({ where, create, update }),
};
