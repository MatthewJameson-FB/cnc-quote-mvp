import SeoLandingPage from '@/app/components/SeoLandingPage'

export const dynamic = 'force-static'

export default function Page() {
  return (
    <SeoLandingPage
      title="Can’t find a replacement part anywhere?"
      intro="Upload a photo and description. If the part is discontinued or out of stock everywhere, we help recreate hard-to-find trim, clips, covers and fittings."
      examples={[
        'The manufacturer no longer sells the part and the car is stuck without it.',
        'You’ve searched everywhere and still can’t find a matching clip, cover or bracket.',
        'A broken trim piece is stopping a vehicle, caravan or motorhome from being finished properly.',
      ]}
    />
  )
}
