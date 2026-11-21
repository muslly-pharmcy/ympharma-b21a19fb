workspace "MUSLLY AI OS - Evidence scoped architecture" "A C4 architecture view of source-evidenced components; not a claim of production readiness." {
    model {
        shopper = person "Shopper" "Browses public medication catalog."
        staff = person "Authorized staff" "Accesses protected clinical and business routes."
        system = softwareSystem "MUSLLY AI OS" "React/TanStack, server services and Supabase integration." {
            web = container "Web application" "Storefront, authenticated routes, AI chat, Mission Control" "React, TanStack Router"
            api = container "Server application" "Catalog, clinical, inventory, sessions, AI runtime" "TypeScript/TanStack Start"
            db = container "Supabase" "Managed data and authentication; actual RLS policies require independent verification." "PostgreSQL / Supabase"
        }
        shopper -> web "Browses storefront"
        staff -> web "Uses authenticated pages"
        web -> api "Requests catalog and operations"
        web -> db "Uses browser-side Supabase auth under RLS"
        api -> db "Uses server-side database integrations"
    }
    views {
        systemContext system "system-context" {
            include *
            autoLayout lr
        }
        container system "containers" {
            include *
            autoLayout lr
        }
        styles {
            element "Person" { background #29456b color #ffffff shape person }
            element "Software System" { background #226ca5 color #ffffff }
            element "Container" { background #568fba color #ffffff }
        }
    }
}
