# Perfil: catálogo animado (o dobro de tudo)

**Pedido (2026-11-25):** "deixar mais completo adicionando mais de tudo e agora alguns com animações, adicione o dobro só que com animações diferentes".

## O que entra
- +14 banners, +12 cores, +18 bordas e +15 insígnias. Totais: 28 banners, 24 cores, 36 bordas, 30 insígnias.
- Todo item novo é animado, cada um com um movimento diferente.
- Todo item novo é liberado por uma insígnia (banners e cores ganham cadeado, como as bordas já tinham). Os itens antigos continuam como estavam (banners e cores livres).
- As 15 insígnias novas também têm ícone animado (parado enquanto bloqueada).

## Regras
- Animações só com CSS (`src/styles/profile-motion.css`), mexendo só em transform, opacity, filter e cor.
- Todas as keyframes ficam dentro de `prefers-reduced-motion: no-preference`: quem pede menos movimento vê o item parado, completo.
- Cor animada: `--accent: var(--accent-anim)`, com `@property --accent-anim` animada em passos (~12 por segundo) para não redesenhar a página a cada quadro.
- O banco recusa item bloqueado com DS005 (borda, banner ou cor). Funções `banner_required_badge` e `accent_required_badge` ao lado de `frame_required_badge`.

## Insígnias novas
| chave | nome | como ganhar |
|---|---|---|
| demo_live | Ao vivo | colocar uma demo no ar |
| prolific | Prolífico | 30 projetos |
| star | Estrela | projeto com 100 curtidas |
| well_voted | Bem votado | resposta com saldo de 10 votos |
| reference | Referência | resposta com saldo de 50 votos |
| researcher | Pesquisador | 50 perguntas |
| tireless | Incansável | 100 respostas |
| legend | Lenda | 100 respostas aceitas |
| reviewer | Avaliador | votar em 50 respostas de outras pessoas |
| first_follower | Primeiro fã | primeiro seguidor |
| connected | Conectado | seguir 10 pessoas |
| supporter | Apoiador | curtir 25 projetos de outras pessoas |
| fan | Fã de carteirinha | curtir 100 projetos de outras pessoas |
| debater | Debatedor | 100 comentários |
| icon | Ícone | 1.000 seguidores |

O mapa item → insígnia está em `src/lib/social/profile-style.ts` (FRAMES, BANNER_UNLOCKS, ACCENT_UNLOCKS) e espelhado em `supabase/migrations/20261125300000_profile_catalog_v3.sql`.

## Abordagens consideradas
1. **Itens novos por conquista (escolhida):** animação vira recompensa e dá motivo para as insígnias novas.
2. Itens novos livres: mais simples, mas as animações perderiam o valor de conquista.
3. Animações em JS (Lottie/canvas): mais ricas, mas pesadas e sem respeitar o "menos movimento" de graça.
