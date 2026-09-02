import { z } from "zod";

/**
 * Mensajes de validación en español.
 *
 * Zod trae los suyos en inglés y acaban a la vista del usuario: en el editor,
 * al subir un JSON o al aplicar. Este mapa cubre los casos que se dan de verdad
 * con nuestro esquema; para el resto se deja el mensaje por defecto.
 */
const NOMBRE_TIPO: Record<string, string> = {
  string: "texto",
  number: "número",
  boolean: "sí/no",
  array: "lista",
  object: "objeto",
  undefined: "nada",
  null: "nulo",
};

const tipo = (t: string) => NOMBRE_TIPO[t] ?? t;

export const mapaErroresEspanol: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.received === "undefined") return { message: "Falta este campo" };
      return { message: `Se esperaba ${tipo(issue.expected)} y llegó ${tipo(issue.received)}` };

    case z.ZodIssueCode.invalid_literal:
      return { message: `El valor tiene que ser ${JSON.stringify(issue.expected)}` };

    case z.ZodIssueCode.invalid_enum_value:
      return {
        message: `"${String(issue.received)}" no es un valor válido. Opciones: ${issue.options.join(", ")}`,
      };

    case z.ZodIssueCode.unrecognized_keys:
      return { message: `Campos que sobran: ${issue.keys.join(", ")}` };

    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: issue.minimum === 1 ? "No puede estar vacío" : `Mínimo ${issue.minimum} caracteres` };
      }
      if (issue.type === "array") return { message: `Hace falta al menos ${issue.minimum}` };
      return { message: `Tiene que ser ${issue.inclusive ? "como mínimo" : "mayor que"} ${issue.minimum}` };

    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Máximo ${issue.maximum} caracteres` };
      if (issue.type === "array") return { message: `Como mucho ${issue.maximum}` };
      return { message: `Tiene que ser ${issue.inclusive ? "como máximo" : "menor que"} ${issue.maximum}` };

    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "url") return { message: "Tiene que ser una dirección web válida (https://…)" };
      if (issue.validation === "email") return { message: "Tiene que ser un correo válido" };
      return { message: "El formato no es válido" };

    default:
      return { message: ctx.defaultError };
  }
};

/** Se llama una vez al cargar `@aribuilder/core`. */
export function instalarMensajesEnEspanol(): void {
  z.setErrorMap(mapaErroresEspanol);
}
