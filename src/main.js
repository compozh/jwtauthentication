import * as Fingerprint2 from 'fingerprintjs2'
import jwtDecode from 'jwt-decode'
import axios from 'axios'

export default class Authentication {
  // web server url
  static _baseUrl

  // hooks handlers
  static _onError
  static _onBeforeLogin
  static _onBeforeRefresh

  static config({baseUrl, onError, onBeforeRefresh, onBeforeLogin}) {
    this._baseUrl = baseUrl
    this._onError = onError
    this._onBeforeLogin = onBeforeLogin
    this._onBeforeRefresh = onBeforeRefresh
    return this
  }

  ////////////////////////////////
  /// AUTHENTICATION FUNCTIONS ///
  ////////////////////////////////

  // LOGIN METHOD
  static async login(login, password, rememberMe) {
    let result = {
      success: false,
      errorMessage: ''
    }
    const fingerprint = await this._getFingerprint()
    if (this._onBeforeLogin) {
      this._onBeforeLogin(login, password, rememberMe, fingerprint)
    }
    const url = this._createUrl('api/authentication/login')
    try {
      const response = await axios.post(url, {
        login, password, rememberMe, fingerprint
      })
      if (response.data.Success) {
        this._setTokens(response, rememberMe)
        result.success = true
      } else {
        const failReason = response.data.FailReason
        result.errorMessage = this._parseErrorMessage(failReason)
        console.warn(result.errorMessage)
      }
    } catch (e) {
      this._errorHandler(e, result)
    }
    return result
  }

  // ALTERNATIVE LOGIN METHOD (QR-CODE)
  static async loginByCode(code) {
    let result = {
      success: false,
      errorMessage: ''
    }
    const fingerprint = await this._getFingerprint()
    if (this._onBeforeLogin) {
      this._onBeforeLogin(code, fingerprint)
    }
    if (code) {
      const url = this._createUrl('api/authentication/alternativelogin')
      try {
        const response = await axios.post(url, {code, type: 2, fingerprint})
        if (response.data.Success) {
          this._setTokens(response)
          result.success = true
        } else {
          const failReason = response.data.FailReason
          result.errorMessage = this._parseErrorMessage(failReason)
          console.warn(result.errorMessage)
        }
      } catch (e) {
        this._errorHandler(e, result)
      }
    } else {
      console.warn('QR-code not passed')
      result.errorMessage = 'QR-code not passed'
    }
    return result
  }

  // CLEAR ALL TOKENS BEFORE LOGOUT
  static clearTokens() {
    const store = this._getRefreshTokenStore()
    store.removeItem('refreshToken')
    sessionStorage.removeItem('accessToken')
  }

  // GET DELEGATED RIGHTS
  static async getDelegatedRights(userId) {
    if (userId) {
      const token = await this.getToken()
      const url = this._createUrl('api/authentication/delegatedRights')
      try {
        const response = await axios.post(url, userId, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        return response.data
      } catch (e) {
        if (this._onError) {
          this._onError(e)
        }
        console.error(e.message)
        return null
      }
    } else {
      console.warn('User id not passed')
      return null
    }
  }

  // APPLY DELEGATED RIGHTS FROM OTHER USERS
  static async applyDelegatedRights(userId) {
    let result = {
      success: false,
      errorMessage: ''
    }
    if (userId) {
      const token = await this.getToken()
      const url = this._createUrl('api/authentication/applyDelegation')
      try {
        const response = await axios.post(url, userId, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.data.Success) {
          this._setTokens(response)
          result.success = true
        } else {
          const failReason = response.data.FailReason
          result.errorMessage = this._parseErrorMessage(failReason)
          console.warn(result.errorMessage)
        }
      } catch (e) {
        this._errorHandler(e, result)
      }
    } else {
      console.warn('User id not passed')
      result.errorMessage = 'User id not passed'
    }
    return result
  }

  // GETTING USER DATA FROM ACCESS TOKEN
  static getUserData() {
    try {
      const accessToken = this._getAccessToken()
      if (accessToken) {
        const userInfo = jwtDecode(accessToken)
        const user = {
          id: userInfo.unique_name,
          login: userInfo.nameid
        }
        const usedKeys = ['unique_name', 'nameid']
        for (let key in userInfo) {
          if (!userInfo.hasOwnProperty(key) || usedKeys.includes(key)) {
            continue
          }
          const value = userInfo[key]
          key = key.replace('____', '')
          user[key] = value
        }
        return user
      } else {
        return null
      }
    } catch (e) {
      if (this._onError) {
        this._onError(e)
      }
      console.warn(e.message)
      this.clearTokens()
    }
  }

  // GETTING ACCESS TOKEN WITH VALIDATION AND REFRESHING
  static async getToken() {
    const tokenIsValid = this._validateToken()
    if (!tokenIsValid) {
      const refreshToken = this._getRefreshToken()
      if (!refreshToken) {
        console.warn('Refresh token not found!')
        this.clearTokens()
        return
      }
      await this._refreshToken(refreshToken)
    }
    return this._getAccessToken()
  }

  //////////////////////////////////
  /// INTERNAL SERVICE FUNCTIONS ///
  //////////////////////////////////

  // URL CONSTRUCTOR
  static _createUrl(url) {
    try {
      if (this._baseUrl) {
        const urlRegExp = /(http|https):\/\/\w+/
        const isAbsolute = urlRegExp.test(this._baseUrl)
        const origin = isAbsolute ? '' : window.location.origin
        const startSeparator = !isAbsolute && !this._baseUrl.startsWith('/') ? '/' : ''
        const endSeparator = this._baseUrl.endsWith('/') ? '' : '/'
        const urlInstance = new URL(url, origin + startSeparator + this._baseUrl + endSeparator)
        return urlInstance.href
      } else {
        console.warn('Base URL not passed. Call auth.config({ baseUrl: \'http(s)://baseUrl\' })')
        return null
      }
    } catch (e) {
      if (this._onError) {
        this._onError(e)
      }
      console.warn('Invalid base URL: expecting string that representing absolute or relative URL.')
      return null
    }
  }

  // CHECKING TOKEN IS VALID
  static _validateToken() {
    let isValid = false
    const accessToken = this._getAccessToken()
    try {
      if (accessToken) {
        const token = jwtDecode(accessToken)
        isValid = Date.now() < token.exp * 1000
      }
    } catch (e) {
      console.warn(e.message)
    }
    return isValid
  }

  // GETTING ACCESS TOKEN
  static _getAccessToken() {
    return sessionStorage.getItem('accessToken')
  }

  // DEFINE REFRESH TOKEN STORE
  static _getRefreshTokenStore() {
    const token = localStorage.getItem('refreshToken')
    return token ? localStorage : sessionStorage
  }

  // GETTING REFRESH TOKEN
  static _getRefreshToken() {
    const store = this._getRefreshTokenStore()
    return store.getItem('refreshToken')
  }

  // QUEUE FOR REFRESH REQUEST AND QUEUE CLEAR FUNCTION
  static _refreshQueue = []
  static _clearRefreshQueue() {
    if (!this._refreshQueue.length) {
      return
    }
    this._refreshQueue.pop()()
    this._clearRefreshQueue()
  }

  // REFRESH ACCESS TOKEN WHEN IS NOT VALID
  static async _refreshToken(refreshToken) {
    if (this._refreshQueue.length) {
      return new Promise(resolve => {
        this._refreshQueue.push(() => resolve())
      })
    }
    this._refreshQueue.push(() => Promise.resolve())
    const fingerprint = await this._getFingerprint()
    if (this._onBeforeRefresh) {
      this._onBeforeRefresh(refreshToken, fingerprint)
    }
    const url = this._createUrl('api/authentication/refresh')
    try {
      const result = await axios.post(url, {refreshToken, fingerprint})
      if (result && result.data.AccessToken) {
        const store = this._getRefreshTokenStore()
        const rememberMe = store === localStorage
        this._setTokens(result, rememberMe)
        this._clearRefreshQueue()
      } else {
        if (this._onError) {
          this._onError(result)
        }
        console.warn(result.data.FailReason)
      }
    } catch (e) {
      this._clearRefreshQueue()
      if (this._onError) {
        this._onError(e)
      }
      throw Error('Refresh error: ' + e)
    }
  }

  // GET TOKENS FROM SERVER RESPONSE AND WRITING TO BROWSER STORE
  static _setTokens(response, rememberMe) {
    const accessToken = response.data.AccessToken
    const refreshToken = response.data.RefreshToken
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem('refreshToken', refreshToken)
    sessionStorage.setItem('accessToken', accessToken)
  }

  // CREATE CLIENT FINGERPRINT
  static async _getFingerprint() {
    return new Promise((resolve, reject) => {
       async function getHash() {
         try {
           const components = await Fingerprint2.getPromise()
           const values = components.map(component => component.value)
           return String(Fingerprint2.x64hash128(values.join(''), 31))
         } catch (e) {
           reject(e)
         }
       }
       if (window.requestIdleCallback) {
         requestIdleCallback(async () => resolve(await getHash()))
       } else {
         setTimeout(async () => resolve(await getHash()), 500)
       }
     })
  }

  // PARSE FAIL REASON
  static _parseErrorMessage(message) {
    const searchRegExp = /FAILREASON/gmi
    if (searchRegExp.test(message)) {
      const trimMessage = message.replace(/[,:]/g, '')
      const parsedMessage = trimMessage.split('""')
      return parsedMessage[1]
    }
    return message
  }

  // ERROR HANDLER
  static _errorHandler(error, result) {
    if (this._onError) {
      this._onError(error)
    }
    if (error.response && error.response.data.FailReason) {
      const reason = error.response.data.FailReason
      result.errorMessage = this._parseErrorMessage(reason)
    } else {
      result.errorMessage = error.message
    }
    console.warn(result.errorMessage)
  }
}
