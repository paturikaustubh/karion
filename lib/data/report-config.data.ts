import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const reportConfigData = {
  findUnique: (where: Prisma.ReportConfigWhereUniqueInput) =>
    prisma.reportConfig.findUnique({ where }),

  create: (data: Prisma.ReportConfigCreateInput) =>
    prisma.reportConfig.create({ data }),

  upsert: (
    where: Prisma.ReportConfigWhereUniqueInput,
    create: Prisma.ReportConfigCreateInput,
    update: Prisma.ReportConfigUpdateInput
  ) => prisma.reportConfig.upsert({ where, create, update }),

  findMany: (where: Prisma.ReportConfigWhereInput) =>
    prisma.reportConfig.findMany({ where }),
};
