import { Ban } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Empty } from '../components/ui'
import { t } from '../lib/i18n'

export default function Blocked({ status }) {
  const { signOut } = useAuth()
  return (
    <div className="setup">
      <div className="card">
        <Empty icon={Ban}
          title={status === 'banned' ? t('Your account has been banned') : t('Your account is suspended')}
          text={t('This happened after a moderator reviewed reports about your activity. Contact the Neighborly admins if you think this is a mistake.')}
          action={<button className="btn btn-outline" onClick={signOut}>{t('Log out')}</button>} />
      </div>
    </div>
  )
}
