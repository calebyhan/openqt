import { useParams } from 'react-router-dom'
import AppLayout from '@/components/layout/AppLayout'
import CampaignCreator from '@/components/campaigns/CampaignCreator'

export default function CampaignEditPage() {
  const { campaignId } = useParams<{ campaignId: string }>()

  return (
    <AppLayout>
      <CampaignCreator campaignId={campaignId} />
    </AppLayout>
  )
}
