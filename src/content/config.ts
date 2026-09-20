import { defineCollection } from "astro:content";
import { file } from "astro/loaders";
import {
  workEntrySchema,
  photographyEntrySchema,
  newsEntrySchema,
  recognitionSchema,
  aboutSchema,
} from "./schemas";

const work = defineCollection({
  loader: file("src/content/work.json"),
  schema: workEntrySchema,
});

const photography = defineCollection({
  loader: file("src/content/photography.json"),
  schema: photographyEntrySchema,
});

const news = defineCollection({
  loader: file("src/content/news.json", { parser: (text) => JSON.parse(text) }),
  schema: newsEntrySchema,
});

const recognition = defineCollection({
  loader: file("src/content/recognition.json"),
  schema: recognitionSchema,
});

const about = defineCollection({
  loader: file("src/content/about.json"),
  schema: aboutSchema,
});

export const collections = { work, photography, news, recognition, about };
