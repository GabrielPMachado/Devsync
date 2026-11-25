# Moderação: perfis e catálogo de personalização (parte 1)

## Por quê
O dono da Devsync quer, pelo /admin, dar e tirar insígnias de qualquer pessoa,
liberar itens, corrigir dados de um perfil e controlar o catálogo (banners,
cores, bordas, insígnias). Tudo com registro de quem fez.

## Objetivos (parte 1)
- Aba **Perfis** no /admin: buscar pessoa; página `/admin/perfis/<username>` com:
  - dados editáveis: nome, @, cargo, localização, status, bio; botões "remover foto" e "remover banner";
    "voltar aparência ao padrão" (banner, cor, borda).
  - insígnias: dar (com ou sem notificação) e tirar, todas as do catálogo.
  - bordas: liberar à mão (sem a insígnia) e tirar a liberação.
  - histórico das ações da moderação sobre essa pessoa.
- Aba **Catálogo**: ligar e desligar cada banner, cor, borda e insígnia.
- Registro `public.admin_actions` (quem, o quê, em quem, detalhes, quando). Só admins leem.

## Regras
- Item desligado some do editor de perfil para quem não o usa. Quem já usa **continua usando**
  (desligar nunca apaga escolha de ninguém). O banco recusa escolher um item desligado.
- Insígnia desligada deixa de ser dada pelos gatilhos; quem já tem continua tendo.
- Item liberado à mão para uma pessoa vale mesmo desligado (vira item "exclusivo").
- Tirar insígnia: sai também das exibidas; se a borda atual dependia dela (e não tem liberação manual), a borda volta ao padrão.
- Tirar liberação de borda: se a pessoa está usando e não tem a insígnia, volta ao padrão.
- Sem linha em `catalog_item_state` = ligado. Assim itens novos do código já nascem ligados
  (sem conflito com quem adiciona itens no código).
- Só admin (`public.assert_admin()`), funções `security definer`, RLS nas tabelas novas, sem escrita direta.

## Abordagens
1. **Estado no banco por cima do catálogo do código** (escolhida para a parte 1): tabelas pequenas
   (`catalog_item_state`, `profile_item_grants`, `admin_actions`) + RPCs `admin_*`. O desenho dos
   itens continua no código.
2. Catálogo inteiro no banco (com desenho em dados): necessário para *criar* itens pelo painel; fica
   para a parte 2 se o dono escolher (pergunta feita na thread).
3. Só código (sem painel): não atende o pedido.

## Fora do escopo (parte 1)
Criar itens novos pelo painel; papel "moderador" separado de admin (hoje só existe admin).
