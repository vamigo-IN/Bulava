-- CreateTable
CREATE TABLE "showcase_sections" (
    "section" TEXT NOT NULL,
    "templateKeys" TEXT[],
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showcase_sections_pkey" PRIMARY KEY ("section")
);

