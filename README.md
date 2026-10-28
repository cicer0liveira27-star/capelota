# Capelota

App da pelada Capelota (terças, 19h): estatísticas por rodada, mês, ano e geral, perfil com foto de cada atleta, prêmios do mês (craque, artilheiro, garçom, paredão e time ideal), sorteio de times, backup e restauração.

Funciona no celular como app (adicione à tela inicial) e abre sem internet.

## Como os dados funcionam

- **Banco compartilhado (Firebase):** todo mundo que abre o link vê os mesmos números em tempo real. Só os masters, com CPF e senha, cadastram, editam e apagam.
- **Modo local:** enquanto o `firebase-config.js` estiver vazio, os dados ficam só no aparelho de quem usa. Serve para testar.

## Ligar o banco compartilhado (uma vez só, uns 10 minutos)

1. Entre em https://console.firebase.google.com e crie um projeto chamado `capelota` (pode desligar o Google Analytics).
2. **Firestore:** menu Build → Firestore Database → Criar banco de dados → modo de produção → região `southamerica-east1 (São Paulo)`.
3. **Regras:** na aba Regras do Firestore, cole as regras que estão no guia privado dos masters (não ficam neste repositório porque têm os logins) e publique.
4. **Login:** Build → Authentication → Começar → ative **E-mail/senha**.
5. **Masters:** em Authentication → Usuários → Adicionar usuário, crie um usuário para cada master com o e-mail `CPF-só-números@capelota.app` e a senha combinada.
6. **Conectar o app:** Configurações do projeto (engrenagem) → Seus apps → ícone `</>` (Web) → registre o app → copie o objeto `firebaseConfig` para dentro do `firebase-config.js` e suba a alteração.

Pronto: abra o app, vá em Ajustes e confira "Banco compartilhado ligado". Se já tinha dados no modo local, baixe o backup antes e restaure depois de ligar o banco.

## Pontuação padrão

Linha: gol 3, assistência 2, vitória 2, empate 1, título 3, presença 1, amarelo −1, vermelho −3.
Goleiro: jogo sem sofrer gol 3, gol 3, assistência 2, presença 1.
Os masters podem mudar os pesos em Ajustes.

## Arquivos

- `index.html`, `style.css`, `app.js` — telas
- `calc.js` — estatísticas, prêmios e sorteio
- `store.js` — banco (Firebase ou local), login dos masters, backup
- `sw.js`, `manifest.webmanifest`, `icons/` — app instalável e offline
