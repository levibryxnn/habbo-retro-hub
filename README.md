# Habbo Retro Hub

Atue como um Engenheiro de Software Full-Stack especialista em aplicações web dinâmicas e design retrô/pixel art. Crie a estrutura completa de um Fã-Site moderno para o Habbo Hotel da Sulake.

### 1. Design & UI/UX

- Estética Pixel Art pautada no Habbo Hotel clássico (paleta de cores amarela, azul, cinza, bordas marcadas, fontes estilo volter/pixeladas para títulos e tipografia limpa para leitura de textos longos).

- Interface responsiva e modular composta por:

  - Header: Logo do fã-site, área de perfil/login do usuário, buscador de nicks.

  - Sidebar: Status dos locutores da rádio (ON/OFF, DJ atual, música atual, botão de Play), top usuários ativos, atalhos rápidos.

  - Main Area: Feed de notícias, fórum, sistema de eventos e formulário de validação/login.

### 2. Integrações de API Oficial da Sulake (Habbo)

Utilize a API pública do Habbo (https://www.habbo.com/api/public/ - adapte o domínio base de acordo com o hotel selecionado, ex: habbo.com.br):

A. Renderização do Avatar (Habbo Imaging):

- Implemente componentes que gerem dinamicamente a imagem do Habbo Avatar a partir do nick informado pelo usuário.

- URL base de renderização: `https://www.habbo.com/habbo-imaging/avatarimage?user={username}&action=std&direction=2&head_direction=2&gesture=sml&size=l`

B. Validação de Nick / Sistema de Autenticação via Missão (Motto Verification):

- O login no fã-site NÃO exige a senha do Habbo. O processo de verificação de posse da conta deve seguir este fluxo:

  1. O usuário digita seu nick do Habbo no fã-site.

  2. O fã-site faz uma requisição para a API do Habbo (`https://www.habbo.com.br/api/public/users?name={username}`) para buscar o perfil e gera um código de verificação único e aleatório (ex: `FS-VERIFY-8492`).

  3. O fã-site exibe a instrução: "Altere a sua Missão/Motto dentro do jogo para: FS-VERIFY-8492 e clique em 'Validar'".

  4. Ao clicar em 'Validar', o sistema consulta a API novamente, checa o campo `motto` do perfil do usuário e, se o código for idêntico, a conta é autenticada e vinculada ao fã-site.

### 3. Banco de Dados & Funcionalidades de Usuário (Supabase Integration)

Estruture o banco de dados e as permissões (RLS) para suportar:

A. Autenticação e Perfis:

- Tabela `users`: id, habbo_username, avatar_look, role (User, Mod, Admin, DJ), points, created_at.

B. Fórum e Notícias:

- Tabela `categories`: Categorias do fórum e das notícias.

- Tabela `topics`: id, user_id, category_id, title, content, views, status (open/pinned/locked), created_at.

- Tabela `comments`: id, topic_id, user_id, content, created_at.

- Tabela `reactions`: id, target_type ('topic' ou 'comment'), target_id, user_id, reaction_type ('like', 'bobba', 'duck', etc.).

C. Funcionalidades de Interação:

- Criar fóruns divididos por categorias (Geral, Eventos, Dúvidas, Anúncios).

- Permitir edição e exclusão de tópicos/comentários apenas pelo próprio autor ou por administradores/moderadores.

- Sistema de reações nos tópicos e comentários com ícones temáticos do Habbo.

### 4. Funcionalidades Adicionais de Fã-Site

- Player de Rádio Web (Stream de áudio HTTP/HTTPS com controles de volume, play/pause e metadados via API de rádio).

- Sistema de Emblemas/Conquistas do Fã-Site (armazenados no banco e exibidos no perfil do usuário no fã-site).

- Módulo de Eventos: Lista de eventos ativos dentro do jogo organizados por horário e criador.

Gere uma arquitetura limpa, componentes React modulares e estilização com Tailwind CSS, integrando hooks para as chamadas de API externas e Supabase para persistência de dados.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/14124f79-d17b-4dbb-bc8a-23f81a61ebcb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
