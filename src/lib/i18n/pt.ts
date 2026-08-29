// Portuguese (Brazil) — community translation, work in progress.
// Partial by design: only the keys below are translated; everything else falls
// through to English (see src/lib/i18n/index.ts and CONTRIBUTING-i18n.md).
//
// To help: copy an English string from en.ts, translate the VALUE, keep the
// KEY, then run `node scripts/check-i18n.mjs` to see what is still missing.

import type { MsgKey } from "./vi";

export const pt: Partial<Record<MsgKey, string>> = {
  "app.title": "Mapa de The Isle",
  "app.minimap_title": "Minimapa",
  "app.fullmap_title": "Mapa Gateway",

  "tab.map": "Mapa",
  "tab.dino": "Seu Dino",
  "tab.settings": "Configurações",
  "tab.garage": "Garagem",
  "tab.guide": "Guia",

  "pos.none": "Sem posição ainda",
  "pos.hint":
    "No jogo pressione Tab, depois clique em “Asset Location” no canto superior direito para copiar suas coordenadas.",
  "pos.off_map": "Fora do mapa",

  "dir.N": "Norte",
  "dir.NE": "Nordeste",
  "dir.E": "Leste",
  "dir.SE": "Sudeste",
  "dir.S": "Sul",
  "dir.SW": "Sudoeste",
  "dir.W": "Oeste",
  "dir.NW": "Noroeste",
  "heading.unknown": "Direção desconhecida",
  "heading.hint": "Copie as coordenadas de novo após se mover para revelar sua direção.",

  "btn.close": "Fechar",
  "btn.ok": "OK",
  "btn.cancel": "Cancelar",
  "btn.save": "Salvar",
  "btn.retry": "Tentar de novo",

  "search.placeholder": "Buscar lugares ou colar coordenadas…",
  "search.no_results": "Nenhum resultado",
  "map.recenter": "Voltar à minha posição",

  "wp.title": "Marcadores",
  "wp.new": "Novo marcador",
  "wp.add": "Adicionar marcador",
  "wp.remove": "Excluir",
  "wp.rename": "Renomear",
  "wp.color": "Mudar cor",
  "wp.empty": "Nenhum marcador ainda. Clique com o botão direito no mapa para adicionar.",

  "trail.title": "Trajeto percorrido",
  "trail.clear": "Limpar trajeto",

  "settings.language": "Ngôn ngữ · Language",
  "settings.minimap": "Minimapa",
  "settings.hotkeys": "Atalhos",
  "settings.data": "Dados",
  "settings.visible": "Mostrar minimapa",


  "firstrun.title": "Baixar dados do mapa",
  "firstrun.start": "Iniciar download",
  "firstrun.downloading": "Baixando…",
  "firstrun.retry": "Tentar de novo",
};
