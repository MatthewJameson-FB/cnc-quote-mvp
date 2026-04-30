import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Custom replacement parts in the UK"
      intro="Need a one-off replacement part made? Upload a photo and tell us what it needs to do so we can recreate the broken bit."
      examples={[
        'A van or caravan part needs replacing and the original is discontinued.',
        'A small bracket or mount is missing and the machine can’t be used safely.',
        'A handle, knob or trim piece has broken off and the item can’t be finished properly.',
      ]}
    />
  )
}
