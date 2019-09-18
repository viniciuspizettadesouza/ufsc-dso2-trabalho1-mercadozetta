# trabalho1-dso2

    INE5612-04238A (20192) - Desenvolvimento de Sistemas Orientados a Objetos II

## Descrição do Sistema

Identifique uma categoria de produtos que você considera útil criar um sistema de vendas (ex: materiais esportivos, informática, livros, etc).

Em sua página inicial, o sistema deve permitir buscar produtos, especificando a descrição do mesmo. Também será possível, a partir da página inicial, acessar a página de login no sistema e a página de cadastramento de um novo usuário. Devem ser usados e-mail e senha para acesso ao sistema.

Os usuários deverão cadastrar-se no sistema, especificando os dados para contato (e-mail, telefone, etc.), dentre outras informações que você considere necessárias.
Os usuários cadastrados poderão cadastrar produtos para venda e também vender produtos.

## Instalar o node

Após o clone do repositório, executar um dos comandos abaixo para carregar os modulos do node.

    yarn install
    npm install

## Para rodar o backend da aplicação:

Dentro da pasta backend, execute o comando abaixo para subir o servidor na porta 3333.

    yarn dev
    npm run-script dev
    onde "dev" é o script criado no arquivo package.json

## Para rodar o frontend da aplicação:

Dentro da pasta frontend, execute o comando abaixo para iniciar a aplicação na porta 3000.

    yarn start

<img src="images/mercadozetta.jpg" width="400">

## Rotas

    (ok) cadastrar usuario
    (ok) autenticação de login
    (ok) lista produtos de usuario especifico
    (ok) cadastro de produto n funciona

## Problemas

if(tamanho do input > 0) {
filter(nome do input === produto.name)
}

busca produtos na pagina inicial

css das outras paginas

achar no video backend para que serve o cors

## Extra

Fazer token de autenticação se der tempo a partir de 6:30

https://www.youtube.com/watch?v=KKTX1l3sZGk
