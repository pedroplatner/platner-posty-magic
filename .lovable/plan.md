## Comparação dia a dia

Adicionar uma nova seção em `/insights` chamada **"Evolução diária"** com tabela/gráfico mostrando o valor de cada métrica por dia (hoje, ontem, anteontem...) e variação % dia a dia.

### Métricas incluídas
- Visitas ao perfil (`profile_views`)
- Cliques no site (`website_clicks`)
- Contas engajadas (`accounts_engaged`)
- Alcance (`reach`)
- Crescimento de seguidores (`follower_count` — novos seguidores por dia)
- Impressões totais (`views`, soma dos posts)

### Como vai funcionar na tela
- Logo abaixo dos cards de "Alcance & Engajamento" entra uma nova seção.
- Linha de "abas" no topo da seção: uma aba por métrica (Perfil, Site, Engajamento, Alcance, Seguidores).
- Ao clicar na aba, mostra:
  - **Gráfico de área** com os últimos 7/14/30/90 dias (respeita o filtro já existente no topo).
  - **Tabela** abaixo: cada linha = 1 dia (mais recente primeiro), colunas: Data | Valor | Δ vs dia anterior (%/absoluto, com seta verde/vermelha).
  - **Card destaque** no canto: "Hoje vs Ontem" com a variação principal.

### Como vamos buscar os dados (parte técnica)

A Meta v22+ tem duas categorias de métrica:

1. **Suportam `period=day` direto com série temporal** (1 chamada devolve todos os dias):
   - `reach`, `follower_count`
   - Já é assim que o gráfico de seguidores funciona hoje.

2. **Exigem `metric_type=total_value`** (devolvem só 1 número agregado):
   - `profile_views`, `website_clicks`, `accounts_engaged`
   - Para obter série diária: **fazer N chamadas em paralelo**, uma por dia, com `since`/`until` cobrindo só aquele dia (00:00–23:59 UTC).
   - Custoso mas é o único jeito na v22+. Para 30 dias = 30 requests × 3 métricas = 90 requests. Mitigação: agrupar as 3 métricas numa única call por dia (`metric=profile_views,website_clicks,accounts_engaged`) → 30 requests só. `React Query` cacheia por dia (`queryKey: ["ig","daily",date]`), `staleTime: 30min`. Períodos menores (7/14 dias) ficam instantâneos.

3. **Por post**: `views` agregado por dia já é derivável do que temos hoje (data do post + views) — sem chamada extra.

### Arquivos a alterar
- `src/lib/insights.ts` — helpers `dayRangeUTC(date)` e `buildDailySeries(metric, days)`.
- `src/routes/insights.tsx` — nova seção `<DailyBreakdown since={since} until={until} days={days} />` inserida após `<ReachCards />`.

### Cuidados
- Hoje (dia em curso) aparece com tag "parcial" porque a Meta só fecha o dia ~3h depois.
- Conta com pouco tráfego (caso atual: 25 seguidores) vai mostrar muitos zeros — é esperado, não é bug. A comparação % vira "—" quando o dia anterior foi 0.
- Não vai aumentar custo de função (Edge Function é só proxy; Meta Graph API não cobra).

### Fora do escopo
- Histórico além de 90 dias (limite da Meta API para essas métricas).
- Exportar CSV (posso adicionar depois se quiser).
- Comparação mês-vs-mês ou semana-vs-semana (foco aqui é diário).
