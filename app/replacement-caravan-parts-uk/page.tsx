import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Replacement caravan parts in the UK"
      intro="Need a caravan part that’s discontinued or impossible to find? Upload a photo and we’ll help recreate the broken piece."
      examples={[
        'Caravan trim clip snapped and the panel won’t sit flush.',
        'A latch or hinge has failed and the door will not close properly.',
        'A cover or bracket is missing and the caravan is stuck until it’s replaced.',
      ]}
    />
  )
}
