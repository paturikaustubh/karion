import prisma from "@/lib/prisma";

export const userSettingsData = {
  find: (userId: number) =>
    prisma.userSettings.findUnique({ where: { userId } }),

  upsert: (userId: number, settings: Record<string, unknown>) =>
    prisma.userSettings.upsert({
      where: { userId },
      update: { settings },
      create: { userId, settings },
    }),
};
