import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err.message === 'Invalid login credentials'
        ? '邮箱或密码不正确'
        : err.message === 'User already registered'
        ? '该邮箱已注册'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">🌙</div>
        <h1 className="auth-title">星月小屋</h1>
        <p className="auth-subtitle">
          {isLogin ? '欢迎回来' : '创建你的小屋'}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            className="auth-input"
            placeholder="邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            className="auth-input"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? '请稍候...' : isLogin ? '进入小屋' : '创建账号'}
          </button>
        </form>

        {error && <p className="auth-error">{error}</p>}

        <p className="auth-switch">
          {isLogin ? '还没有账号？' : '已有账号？'}
          <button onClick={() => { setIsLogin(!isLogin); setError('') }}>
            {isLogin ? '注册一个' : '去登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
