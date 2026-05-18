# Fechamento Onda 6 + Onda 7

## Onda 6 — Limpeza de bundle (shadcn não usados)

Hoje `src/components/ui/` tem ~46 arquivos. Apenas 14 são realmente importados no projeto:

`alert-dialog, button, calendar, dialog, input, label, popover, separator, sheet, skeleton, sonner, textarea, toggle, tooltip`

**Ação:** deletar os 32 componentes não usados:

```
accordion, alert, aspect-ratio, avatar, badge, breadcrumb, card, carousel,
chart, checkbox, collapsible, command, context-menu, drawer, dropdown-menu,
form, hover-card, input-otp, menubar, navigation-menu, pagination, progress,
radio-group, resizable, scroll-area, select, sidebar, slider, switch, table,
tabs, toggle-group
```

E remover do `package.json` as dependências que ficarem órfãs (ex.: `embla-carousel-react`, `cmdk`, `vaul`, `recharts`, `input-otp`, `react-resizable-panels`, `@radix-ui/*` que só esses componentes usavam).

**Validação:** rodar build/typecheck após exclusão para garantir que nada quebrou.

## Onda 7 — Notificações ativas de falha

Hoje só temos a tela `/historico` (passiva) e o `OfflineBanner`. Falta avisar o usuário quando algo dá erro.

**Ação:**

1. **Toaster global** já existe (`sonner`). Padronizar uso via util `notify.ts` com helpers `notify.error/success/info`.
2. **Avisos automáticos em:**
   - Falha de IA (legenda/hashtags): toast de erro com mensagem (já mapeia 402 → "créditos esgotados").
   - Falha de salvar post (`novo-post`): toast em vez de console.
   - Retry em `historico`: toast de sucesso/erro.
   - OfflineBanner: adicionar toast quando voltar online.
3. **Indicador no Sidebar** ao lado de "Histórico": badge vermelho com a contagem de posts em `status='erro'`, lendo do Supabase com um pequeno polling (30s) ou refetch ao focar a janela.
4. **Detecção proativa**: ao carregar o app (root), buscar posts com `status='erro'` da última 1h e disparar um toast resumo ("3 posts falharam — ver histórico") com ação que navega para `/historico`.

**Validação:** simular erro (rejeitar IA / desligar internet) e verificar toasts; checar badge do sidebar com um post `status='erro'` no banco.

## Fora de escopo

- Onda 4 (Instagram API) — adiada.
- Testes, PWA, multi-conta, SEO, a11y — não solicitados agora.

## Arquivos afetados (resumo)

- Deletar: 32 arquivos em `src/components/ui/`.
- Editar: `package.json`, `src/lib/notify.ts` (novo), `src/components/NewPostForm.tsx`, `src/components/OfflineBanner.tsx`, `src/components/AppSidebar.tsx`, `src/routes/historico.tsx`, `src/routes/novo-post.tsx`, `src/routes/__root.tsx`.
