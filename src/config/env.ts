import "dotenv/config";
import { z } from "zod";

/**
 * All process.env access lives here and nowhere else. Fail fast on boot
 * if something required is missing, instead of surfacing a confusing
 * error deep inside a request handler later.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),

  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required"),
  FIREBASE_CLIENT_EMAIL: z.string().min(1, "FIREBASE_CLIENT_EMAIL is required"),
  FIREBASE_PRIVATE_KEY: z.string().min(1, "FIREBASE_PRIVATE_KEY is required"),

  REVENUECAT_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.5"),
  ONESIGNAL_APP_ID: z.string().optional(),
  ONESIGNAL_REST_API_KEY: z.string().optional(),

  STORAGE_BUCKET: z.string().optional(),
  APP_BASE_URL: z.string().url().default("http://localhost:8080"),
  SIGNING_BASE_URL: z.string().url().default("http://localhost:8080/sign"),
});

function loadEnv() {
  // In test runs we don't want a missing Firebase key to blow up every
  // unit test — individual test files stub what they need.
  if (process.env.NODE_ENV === "test") {
    return envSchema.parse({
      FIREBASE_PROJECT_ID: "test-project",
      FIREBASE_CLIENT_EMAIL: "test@test-project.iam.gserviceaccount.com",
      // Syntactically valid but throwaway — never used to sign or verify
      // anything real; it only exists so firebase-admin's cert() parser
      // doesn't reject the PEM format during app construction in tests.
      FIREBASE_PRIVATE_KEY:
        "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDuuuZi2kyOu1aB\nA0ETLbFlLkldFJCT3DY7esx2bZG6kOIQu2ba0YblCio+NZQnFMW3en+zCHDxzEJ0\nwhUqFJES7ByTwZp3yYBLNCP4nsO5v/Itfbhq/svjpvaAVsRhTtXJ9OV/f3dfk3PG\nW/cY0qtWLK9jqV7cU1oOS75Wm3FkEEiI8lqFXj5MoGWUfEbK9RJND3U6JSsGkeQ2\ni5a+cgKUf2WRFC66UuGaPYb6vWIc2oB5b5EsEyFWyx8pQIlO5s3JExOe+D1x5fS0\nw+m2zTM9Vd+kr9OJkixnOiZlZUrNxqwULnQiLKfIJrD5LE4th5MXfQIRm1AKkNch\nCkozJvl3AgMBAAECggEABq38Ex23Z83U8cqYYBq2ntD9Tacj7+O/wwAAmbH6knCl\noqWk2D34BEZL9yUQowBxN8q+O2OZpWpW0/fKPGF4FIt1kTzNiH/sjndEKBuNr4+v\n6Luny5stfLLjP1wJk8QBf1o/+H1KQlih2KgiFc8mD44PYRnrhP2EoB5YtsA4ZJBN\nqXCgUyMWiSQdn8GjOCYf/SydegsDWIMAvEHmT1LAv+a3nUfYjW+wH5W9juzBVmYf\n2BLJ+mFiXwKHRsQur7PBUqluqQVlDi3QtoO0HAAHEuqQbwNwm7CG+nZANklWi7yu\nHYN2RKLnxE61QcVoiW7zKU6KcbOX0QIcVyoWqvuVoQKBgQD+Ql3xbzXCKCpvGQsU\n/tKO6CCOe4dmJ8haDo3IcBjOMFUDQZ6jqI+rXwjao7HJ0G3PWknkno4AOUJsAmmW\nXJQfbf2Q/yqYd6BPvr+Pb531G6gQpauyAB1rW5hKSmb+O9Reu1Nwl2o7oSAkD+kS\nViyGCipdQZ7pqVVDgaAZUYe+7QKBgQDwXVDA89tZAlh1bE7f25VKiETtohFoy7ZM\nl8nAu6b5yNZJ0c7gFzvGP34lgY/Th8XjEtAv8Ifld8tP+CqrkEHI+4btGe6e+WSD\nP+kuhcoOkrtNOGR5F7JycrC5P42zAu/jvKyI/jDGkX/o/DI9Cj6RXS4PwfrpXgMR\nF2CZ9LFpcwKBgQCQLbwty11VowclBrN1DWcC6HiFs2C9OfPvtW8K6R331gpvFUfL\nECugBvzzVn3brhiGy3E5dfuZ/t4+d0O+ovLPu8Rc84UI/lTmw4jG4olU04EDJ57s\nCgqktUTvY69xnSW5LkqLfyEbfSvHp0oIPttyitMpHKvrXj1eUWQi10u9pQKBgQCg\n3YMPL+VMY9J5+9up3FbFBABFneLS5QuDpU6Ea9Jrd6tayk0PEt2RZ6rwRQ7R/htF\nRrEIdI0u2Qa75ZYBLlGoxhXeFy3pPXW0lZBk72t0Z2VtX+F2XZKzH+kAgfU+qieM\nnhhGswBH1NbrQeYJjhKjzN3n8+YOSzn4NVIUl3wo2wKBgGMlIdaDu1CZ1swDyOx4\n37A1qpo5ljQ+ia7vcxHAtrFEhgqDUgrsTkXTUkiKXRhrnNG+K7QpK094DFSxA2rd\nLSiEFcMsQTQcr2Fptzyuzw6WsVbA4Uu+r7EJrvVMQYewmL49lsAEjKMhm1vu33tk\n6w0niAvmJHWGbQcBbHtTfhs0\n-----END PRIVATE KEY-----\n",
      ...process.env,
    });
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = typeof env;
