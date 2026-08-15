const UNIT_NAMES = [
  'Unidad del Fuego', 'Bloque del Titán', 'Muro de Esparta', 'Santuario de Apolo',
  'Forja de Hefesto', 'Trono del Olimpo', 'Puente de Aqueronte', 'Torre de Atenea',
];
const TOPIC_NAMES = [
  'Fundamentos del Conocimiento', 'Dominio del Campo', 'Ritual de Estudio',
  'Conquista del Temario', 'Prueba del Guerrero', 'Sendero del Erudito',
];
const SUBTOPIC_NAMES = [
  'Núcleo esencial', 'Profundización', 'Repaso final', 'Detalle crítico',
];

export function suggestUnitName(index: number): string {
  return UNIT_NAMES[index % UNIT_NAMES.length];
}

export function suggestTopicName(index: number): string {
  return TOPIC_NAMES[index % TOPIC_NAMES.length];
}

export function suggestSubtopicName(index: number): string {
  return SUBTOPIC_NAMES[index % SUBTOPIC_NAMES.length];
}
