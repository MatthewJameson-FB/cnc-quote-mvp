import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Replacement caravan parts in the UK"
      intro="Need a caravan part that’s discontinued or impossible to find? Upload a photo and we help recreate small fittings, trims and brackets."
      examples={[
        'A trim clip snapped and the panel will not sit flush.',
        'A latch, hinge or fitting is missing and the door will not close properly.',
        'A cover or bracket is unavailable from the original supplier.',
      ]}
    />
  )
}
