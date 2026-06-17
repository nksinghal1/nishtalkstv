import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import './PasswordModal.css'

export default function PasswordModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const { login } = useAuth()

  const handleSubmit = () => {
    const success = login(password)
    if (success) {
      onClose()
    } else {
      setError(true)
      setPassword('')
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal password-modal">
        <div className="pw-icon">
          <Lock size={20} />
        </div>
        <h2>Admin Access</h2>
        <p>Enter your password to log or edit shows.</p>

        <input
          className={`input pw-input ${error ? 'pw-error' : ''}`}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />

        {error && <span className="pw-error-msg">Incorrect password</span>}

        <div className="pw-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Unlock</button>
        </div>
      </div>
    </div>
  )
}
