import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    date: z.date(),
    excerpt: z.string(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    // Forgiving on purpose: a strict z.string().url() turns one typo (blank
    // field, or a URL typed without "https://", both easy mistakes in the
    // CMS editor) into a build failure for the whole site, not just one post.
    externalUrl: z.preprocess((val) => {
      if (typeof val !== "string") return val;
      const trimmed = val.trim();
      if (trimmed === "") return undefined;
      return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    }, z.string().url().optional()),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
