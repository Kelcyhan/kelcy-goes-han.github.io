import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/react'
import { ActionButton } from '@/components/primitives'

export function ClerkAccountControls() {
  return (
    <div className="clerk-account-controls">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <ActionButton variant="ghost" size="sm" className="h-7 px-2" title="Sign in">
            Sign in
          </ActionButton>
        </SignInButton>
        <SignUpButton mode="modal">
          <ActionButton variant="ghost" size="sm" className="h-7 px-2" title="Sign up">
            Sign up
          </ActionButton>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  )
}
