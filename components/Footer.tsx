import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-xl"
            >
              <span className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-sm">
                B
              </span>
              <span>Blogify</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              A modern blogging platform built for creators who care about
              quality.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold mb-3">Product</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/blog" className="hover:text-foreground transition">
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/search"
                  className="hover:text-foreground transition"
                >
                  Search
                </Link>
              </li>
              <li>
                <Link
                  href="/write"
                  className="hover:text-foreground transition"
                >
                  Write
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold mb-3">Company</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="#" className="hover:text-foreground transition">
                  About
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground transition">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-foreground transition">
                  Terms
                </Link>
              </li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="font-semibold mb-3">Account</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link
                  href="/auth/login"
                  className="hover:text-foreground transition"
                >
                  Log in
                </Link>
              </li>
              <li>
                <Link
                  href="/auth/sign-up"
                  className="hover:text-foreground transition"
                >
                  Sign-up
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Blogify. Built for portfolio excellence.
        </div>
      </div>
    </footer>
  );
}
