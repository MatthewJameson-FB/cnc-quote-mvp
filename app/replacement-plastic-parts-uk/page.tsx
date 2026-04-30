import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Replacement plastic parts in the UK"
      intro="Can’t find a replacement plastic part? Upload a photo and we’ll help recreate the part that has snapped, worn out, or gone missing."
      examples={[
        'A plastic clip snapped off and the assembly no longer holds together.',
        'A cover or trim piece is missing and the product can’t be used properly.',
        'A knob, handle or bracket is unavailable from the manufacturer.',
      ]}
    />
  )
}
