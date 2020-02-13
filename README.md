# @it-enterprise/jwtauthentication

@it-enterprise/jwtauthentication - это клиенская библиотека для работы с аутентификацией и авторизацией по схеме Token-Based Authentication с использованием стандарта JSON Web Tokens.

>Токены предоставляют собой средство авторизации для каждого запроса от клиента к серверу.  
Токены генерируются на сервере основываясь на секретном ключе, который хранится на сервере.  
Токен хранится на клиенте и используется при необходимости авторизации како-го либо запроса.

### JSON Web Tokens!

JSON Web Token (JWT) — содержит три блока, разделенных точками: заголовок(header), набор полей (payload) и сигнатуру. Первые два блока представлены в JSON-формате и дополнительно закодированы в формат base64. Набор полей содержит произвольные пары имя/значения, притом стандарт JWT определяет несколько зарезервированных имен (iss, aud, exp и другие).

**Принцип работы:**  
Для авторизации используется логин/пароль и fingerprint.
>Что такое **fingerprint**? Это инструмент отслеживания браузера вне зависимости от желания пользователя быть идентифицированным. Это сгенерированный хеш на базе неких уникальных параметров/компонентов браузера. Преимущество fingerprint'a в том, что он нигде персистентно не хранится и генерируется только в момент логина и обновления токена.  
  
**...таким образом:**
  - Пользователь логинится в приложении, передавая логин/пароль и fingerprint
  - Сервер проверят подлинность логина/пароля
  - В случае удачи создает и записывает сессию в БД
  - Отправляет клиенту два токена **access** и **refresh token** (uuid взятый из выше созданной сессии)  
    `accessToken": "eyJhbGciOiJIUzI1NiIs...",`  
    `refreshToken": "9f34dd3a-ff8d-43aa-b286-9f22555319f6`
  - Библиотека сохраняет токены, используя **access token** для последующей авторизации запросов.

**access token** - используется для авторизации запросов и хранения информации о пользователе.  
**refresh token** - выдается сервером по результам успешной аутентификации и используется для получения новой пары access/refresh токенов.
Каждый токен имеет свой срок жизни, `access`: 30 мин, `refresh`: 60 дней
Перед каждым запросом библиотека предварительно проверяет время жизни access token'а и если оно истекло использует refresh token чтобы обновить ОБА токена и продолжает использовать новый access token.

### Установка
```sh
npm install @it-enterprise/jwtauthentication
```

### Подключение
Для использования библиотеки ее необходимо импортировать в главном файле приложения (например `main.js`).  
```js
// main.js
import auth from '@it-enterprise/jwtauthentication'
```

### Конфигурирование
Настройка конфигурации предполагает передачу объекта с опциями в метод `config`.  
Опции включают в себя три параметра:  
 -`baseUrl` (обязательный) - абсолютный или относительний путь к GraphQlServer.
```js
// main.js
auth.config({ baseUrl: 'https://m.it.ua/GraphQlServer/'})
auth.config({ baseUrl: 'http://localhost:5002'})
```
если базовый URL относительный, адрес хоста будет взят из `window.location.origin`
```js
// В данном примере при запуске на локальной машине получим http://localhost:8080/ForceBPM/GraphQlServer/
auth.config({ baseUrl: 'ForceBPM/GraphQlServer'})
```
 -`onError` (не обязательный) - функция-обработчик ошибок, принимает на вход объект ошибки `error`.  
Если передана, вызывается в случае возникновения ошибок в запросах к серверу аутентификации.
```js
// main.js
auth.config({
  baseUrl: window.myConfig.GrapgQlUrl,
  onError: e => {
    e.response && e.response.status === 400
      ? store.dispatch('auth/logout')
      : console.log(e)
  }
})
```
 -`onBeforeRefresh` (не обязательный) - функция вызываемая перед каждым запросом на обновление токена.
На вход принимает `refreshToken` и `fingerprint` с которыми отправляется запрос.
```js
// main.js
auth.config({ 
    baseUrl: 'https://m.it.ua/GraphQlServer/',
    onBeforeRefresh: (refreshToken, fingerprint) => {
      console.error('refreshToken:', refreshToken, 'fingerprint:', fingerprint)
  }
})
```
### API

##### Login (async)
Реализует стандартный способ входа с использованием логина и пароля и возвращает Promise c объектом результата:
```js
auth.login('login', 'password', rememberMe)
// return
{
  success: true/false,
  errorMessage: ''
}
```

##### LoginByCode (async)
Реализует способ входа с использованием QR-code и возвращает Promise c объектом результата:
```js
auth.loginByCode('code')
// return
{
  success: true/false,
  errorMessage: ''
}
```

##### GetDelegatedRights (async)
Запрашивает делегированные права с сервера и возвращает Promise c массивом делегированных прав либо `null` в случае неудачи:
```js
auth.getDelegatedRights('userId')
// return
delegatedRights: [
    {
        USERID: 'userId',
        USERNAME: 'userName',
        IsActive: true/false
    }
]
```

##### ApplyDelegatedRights (async)
Применяет делегированные права другого пользователя и возвращает Promise c объектом результата:
```js
auth.applyDelegatedRights('userId')
// return
{
  success: true/false,
  errorMessage: ''
}
```

##### GetToken (async)
Возвращает валидный `accessToken` либо `undefined` если токен отсутсвует.
```js
auth.getToken()
```
Используется для проверки наличия токена при переходе на защищенный роут,
а так же для добавления токена к запросам в виде хедера. Например:
```js
const token = await auth.getToken()
headers: {
  'Authorization': `Bearer ${token}`
}
```

##### GetUserData
Парсит `accesToken` и возвращает информацию о пользователе в виде объекта, либо `null` в случае отсутствия токена:
```js
auth.getUserData()
// return
{
    id: 'userId',
    login: 'userLogin',
    userName: 'userName',
    userPhoto: 'http(s)://linkToUserPhoto',
    otherServiceFilds: 'exp', 'iat', 'nbf'...
}
```

##### ClearTokens 
Удаляет токены из всех хранилищ.  
Используется при выходе из приложения или переходе на страницу логина.:
```js
auth.clearTokens()
```

### Рекомендации
- В первую очередь убидетесь, что базовий путь к GraphQlServer корректный и передан в виде строки.
- Для обработки результатов асинхронных методов используйте конструкцию async/await или .then()/.catch()
- Все открытые методы библиотеки обрабатывают ошибки и выводят соответсвующие сообщения в консоль.
- Если сервер вернул ошибку во время запроса она также будет отображена перед сервисным сообщением.
- При работе с серверным API, необходимо перехватывать ошибки `statusCode = 401 (unauthorized)` 
  для перенаправления пользователя на страницу логина.
- Если в приложении используются делегированные права можно запрашивать их при получении данных пользователя и объеденять на уровне клиентского приложения. Например:
```js
const user = auth.getUserData()
user.delegatedRights = await auth.getDelegatedRights(user.id) || []
```
