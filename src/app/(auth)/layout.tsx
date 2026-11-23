export default function AuthLayout({ children }: LayoutProps<"/">) {
  return <div className="flex min-h-dvh flex-1 flex-col">{children}</div>;
}
