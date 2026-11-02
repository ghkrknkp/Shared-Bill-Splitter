import { Hono } from 'hono'
import { balancesRoute } from './routes/balances'
import { billsRoute } from './routes/bills'
import { homesRoute } from './routes/homes'
import { membersRoute } from './routes/members'
import { paymentsRoute } from './routes/payments'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/', homesRoute)
app.route('/', membersRoute)
app.route('/', billsRoute)
app.route('/', paymentsRoute)
app.route('/', balancesRoute)

export default app
