import './LoadingSpinner.css'

export default function LoadingSpinner({ text = 'Загрузка...' }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {text && <span className="spinner-text">{text}</span>}
    </div>
  )
}
