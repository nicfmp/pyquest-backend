# XP integrado ao painel

Atualize os DOIS projetos juntos (frontend e backend).

## Backend
- Instale as dependências com `npm ci`.
- Mantenha suas variáveis DATABASE_URL e JWT_SECRET configuradas.
- Execute `npm start` ou publique novamente no Render.
- Não é necessária alteração manual nas tabelas: o resumo usa o estado já salvo em game_progress.

## Frontend
- Instale com `npm ci`.
- Mantenha a configuração da URL da API usada no seu ambiente.
- Execute `npm run dev` para testar ou `npm run build` para publicar.

## Comportamento
- Cada primeira conclusão de atividade mantém o XP calculado pelo jogo, de acordo com a recompensa e as vidas restantes.
- O painel mostra XP total (quests + Pyton Knight), XP do jogo e atividades concluídas de 20.
- O progresso já existente no banco também aparece após o login.
- Voltar ao painel aguarda o salvamento. Se a conexão falhar, o jogo permanece aberto e permite tentar novamente.
- Repetir uma atividade não concede XP novamente, seguindo a regra existente do jogo.

## Validação realizada
Build de produção do frontend, sintaxe do backend, resumo de XP, conclusão/repetição de atividade, recarga do estado e falha de salvamento com nova tentativa.
A conexão com seu PostgreSQL de produção não foi testada neste ambiente.
