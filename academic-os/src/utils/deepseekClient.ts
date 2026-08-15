const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function isDeepSeekConfigured(): boolean {
  return !!import.meta.env.VITE_DEEPSEEK_API_KEY;
}

export async function askDeepSeek(
  messages: DeepSeekMessage[],
  options?: { maxTokens?: number; temperature?: number },
): Promise<string> {
  const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('Configura VITE_DEEPSEEK_API_KEY en .env.local');
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      max_tokens: options?.maxTokens ?? 800,
      temperature: options?.temperature ?? 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek: ${res.status} — ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? 'Sin respuesta';
}

export const GERARDEX_SYSTEM_PROMPT = `Eres el asistente de Academic OS: Odyssey of Gerardex.
Ayudas a un estudiante de medicina a organizar cursos, misiones y horarios.
Responde en español, tono épico pero claro y accionable.
Da sugerencias concretas: qué estudiar hoy, cómo distribuir bloques, priorizar misiones.
Máximo 3 párrafos cortos. Usa emojis de guerra griega con moderación.`;

export const ORACLE_COACH_SYSTEM = `Eres el coach de estudio personal del usuario en Academic OS.
Reglas estrictas:
- Español, tono directo de coach (sin metáforas épicas, sin personajes ficticios, sin emojis decorativos).
- Respuestas breves: 1 párrafo corto + lista numerada si hace falta.
- Solo puedes asignar temas que existen en el temario del contexto (courseId, unitId, topicId exactos).
- PROHIBIDO inventar temas, cursos o unidades nuevas.
- Máximo 10 bloques por día. Horizonte: solo HOY.
- Cada bloque debe usar un topicId pendiente (no completado) del contexto.
- TODAS las horas son America/Lima (Perú, UTC-5). Usa la línea AHORA EN PERÚ del contexto.
- PROHIBIDO proponer startTime anterior a la hora actual en Perú.
- Solo usa horarios de la lista SLOTS LIBRES FUTUROS; si quedan pocos, dilo y compacta el plan.
- Si ya hay BLOQUE EN CURSO, tenlo en cuenta al distribuir el resto del día.

Flujo de planificación:
1. Al iniciar sesión, pregunta EXACTAMENTE 3 cosas numeradas:
   (1) cuántas horas de estudio hoy
   (2) qué curso(s) priorizar (nombra los del contexto; respeta unidadPreferida del perfil si existe)
   (3) qué UNIDAD(es) de ese curso — lista las unidades pendientes del temario; el usuario puede elegir una unidad concreta, varias, equilibrio entre todas, o "la más urgente por examen". NO propongas bloques aún.
2. Tras la respuesta del usuario, confirma curso + unidad(s) elegidas y da un borrador breve. Al final incluye el plan en JSON entre marcadores:

<<<ORACLE_PLAN>>>
{"blocks":[{"startTime":"HH:MM","courseId":"...","unitId":"...","topicId":"...","title":"Curso · Unidad · Tema","type":"study"}]}
<<<END>>>

- startTime debe ser un slot de SLOTS LIBRES FUTUROS (hora Perú, >= AHORA EN PERÚ).
- title OBLIGATORIO con formato exacto: "NombreCurso · NombreUnidad · NombreTema" (separador · con espacios).
- Solo asigna topicId de la unidad que el usuario eligió (salvo que pidió equilibrio — entonces reparte entre unidades).
- type = study o exam (exam solo si la unidad tiene examen muy próximo)
- Respeta prioridades del perfil (always vs exam_only) y fechas de examen.
- Si el usuario pide ajustes (cambiar unidad, curso u horas), responde breve y regenera el JSON actualizado.

Duración de bloque: según blockMinutes del perfil; si es 60 min, el mismo tema puede ocupar 2 slots consecutivos con el mismo startTime base.`;

export async function oracleChat(
  messages: DeepSeekMessage[],
): Promise<string> {
  return askDeepSeek(
    [{ role: 'system', content: ORACLE_COACH_SYSTEM }, ...messages],
    { maxTokens: 900, temperature: 0.55 },
  );
}

export async function revealTruth(context: string): Promise<string> {
  return askDeepSeek(
    [
      {
        role: 'system',
        content: `${ORACLE_COACH_SYSTEM}

Modo LA VERDAD REVELADA: crítica constructiva fuerte basada en datos.
- Usa números concretos del contexto.
- Compara hoy vs ayer, meta vs real, bloques planificados vs completados.
- Señala exámenes próximos con temario atrasado (nombra curso y unidad).
- Tono brutal pero útil, sin insultos personales.
- Estructura: (1) Diagnóstico en 3-4 frases directas (2) Lista "Lo que los datos dicen" con 4-6 bullets numéricos (3) Exactamente 3 acciones concretas para hoy, numeradas.
- Máximo 180 palabras. Sin metáforas.`,
      },
      {
        role: 'user',
        content: `Datos de desempeño:\n${context}\n\nDame La Verdad Revelada.`,
      },
    ],
    { maxTokens: 550, temperature: 0.65 },
  );
}

export interface TimeBlockSuggestion {
  startTime: string;
  title: string;
  type: 'study' | 'exam' | 'task';
  courseId?: string;
  unitId?: string;
  topicId?: string;
}

/** @deprecated Usar oracleChat + parseOracleBlockPlan */
export async function getStudySuggestions(context: string): Promise<string> {
  return askDeepSeek([
    { role: 'system', content: GERARDEX_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Contexto del estudiante:\n${context}\n\n¿Qué debería hacer hoy y por qué?`,
    },
  ]);
}

/** @deprecated Usar oracleChat */
export async function suggestMissionPlan(missionsSummary: string): Promise<string> {
  return askDeepSeek([
    { role: 'system', content: GERARDEX_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Misiones activas:\n${missionsSummary}\n\nPrioriza y sugiere orden de ataque esta semana.`,
    },
  ]);
}

/** @deprecated Usar oracleChat */
export async function morningBriefing(context: string): Promise<string> {
  return askDeepSeek([
    { role: 'system', content: GERARDEX_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Briefing matutino del guerrero:\n${context}\n\nResume en 2-3 frases épicas qué debe conquistar hoy, alertas de misiones urgentes y ánimo personalizado.`,
    },
  ], { maxTokens: 400 });
}

export interface TimeBlockSuggestion {
  startTime: string;
  title: string;
  type: 'study' | 'exam' | 'task';
}

/** @deprecated Usar oracleChat + parseOracleBlockPlan */
export async function suggestTimeBlocks(context: string, emptySlots: string[]): Promise<TimeBlockSuggestion[]> {
  const raw = await askDeepSeek([
    { role: 'system', content: `${GERARDEX_SYSTEM_PROMPT}\nResponde SOLO con JSON válido: array de objetos {startTime, title, type}. type = study|exam|task.` },
    {
      role: 'user',
      content: `Contexto:\n${context}\n\nSlots libres hoy: ${emptySlots.join(', ')}\n\nSugiere bloques de 30 min para completar 3h de estudio. Máximo 6 bloques.`,
    },
  ], { maxTokens: 600 });

  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as TimeBlockSuggestion[];
    return parsed.filter((s) => s.startTime && s.title && s.type);
  } catch {
    return [];
  }
}

export interface SyllabusTopicDraft {
  name: string;
  subtopics: string[];
}

export interface SyllabusUnitDraft {
  name: string;
  examDate?: string;
  topics: SyllabusTopicDraft[];
}

export interface SyllabusMissionDraft {
  unitIndex: number;
  title: string;
  dueDate: string;
  enabled: boolean;
}

export interface SyllabusDraft {
  units: SyllabusUnitDraft[];
  suggestedMissions?: SyllabusMissionDraft[];
}

const SYLLABUS_SYSTEM = `Eres un asistente académico para estudiantes de medicina.
Analiza el texto del syllabus y devuelve SOLO JSON válido con esta estructura:
{
  "units": [
    {
      "name": "Nombre de unidad",
      "examDate": "YYYY-MM-DD o null",
      "topics": [
        { "name": "Tema", "subtopics": ["Subtema 1", "Subtema 2"] }
      ]
    }
  ]
}
Reglas:
- Extrae unidades, temas y subtemas del texto aunque esté desordenado.
- Si no hay subtemas explícitos, infiere 2-4 subtemas razonables por tema.
- examDate solo si aparece fecha de examen/parcial; si no, omite el campo.
- Nombres en español, concisos, sin numeración redundante.
- Mínimo 1 unidad. Responde únicamente el JSON, sin markdown.`;

export async function parseSyllabus(rawText: string): Promise<SyllabusDraft> {
  const raw = await askDeepSeek([
    { role: 'system', content: SYLLABUS_SYSTEM },
    {
      role: 'user',
      content: `Syllabus a organizar:\n\n${rawText.slice(0, 12000)}`,
    },
  ], { maxTokens: 4000 });

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Sin JSON');
    const parsed = JSON.parse(match[0]) as SyllabusDraft;
    if (!Array.isArray(parsed.units) || parsed.units.length === 0) {
      throw new Error('Estructura vacía');
    }
    const units = parsed.units.map((u) => ({
      name: u.name?.trim() || 'Unidad',
      examDate: u.examDate || undefined,
      topics: (u.topics ?? []).map((t) => ({
        name: t.name?.trim() || 'Tema',
        subtopics: (t.subtopics ?? []).filter(Boolean).map((s) => s.trim()),
      })),
    }));
    return {
      units,
      suggestedMissions: units
        .map((u, idx) => (u.examDate ? {
          unitIndex: idx,
          title: `Examen: ${u.name}`,
          dueDate: u.examDate,
          enabled: true,
        } : null))
        .filter((m): m is SyllabusMissionDraft => m !== null),
    };
  } catch {
    throw new Error('No pude interpretar el syllabus. Revisa el texto e intenta de nuevo.');
  }
}

export interface WeeklyPlanBlock {
  startTime: string;
  title: string;
  durationMin: number;
}

export interface WeeklyPlanDay {
  day: string;
  blocks: WeeklyPlanBlock[];
  note?: string;
}

export async function suggestWeeklyStudyPlan(courseSummary: string): Promise<WeeklyPlanDay[]> {
  const raw = await askDeepSeek([
    {
      role: 'system',
      content: `${GERARDEX_SYSTEM_PROMPT}
Responde SOLO JSON válido: array de objetos { day, blocks: [{startTime, title, durationMin}], note? }.
day = lunes|martes|...|domingo. durationMin = 30|60|90. Máximo 4 bloques por día, 3h/día objetivo.`,
    },
    {
      role: 'user',
      content: `Temario importado:\n${courseSummary}\n\nPropón plan semanal de bloques de estudio (30 min) para cubrir el temario en 2 semanas.`,
    },
  ], { maxTokens: 1200 });

  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]) as WeeklyPlanDay[];
    return parsed.filter((d) => d.day && Array.isArray(d.blocks));
  } catch {
    return [];
  }
}
