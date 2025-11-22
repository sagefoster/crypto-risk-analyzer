# Setting Up Custom Domain: cryptorisk.blocksage.tech

## Option 1: Manual Setup via Vercel Dashboard (Recommended)

### Step 1: Add Domain in Vercel

1. Go to https://vercel.com/dashboard
2. Select your project: `crypto-risk-analyzer-zeta` (or similar)
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter: `cryptorisk.blocksage.tech`
6. Click **Add**

### Step 2: Get DNS Records from Vercel

After adding the domain, Vercel will show you DNS records. You'll typically see:
- **Type**: CNAME
- **Name**: `cryptorisk` (or `cryptorisk.blocksage.tech`)
- **Value**: Something like `cname.vercel-dns.com.` or a specific Vercel CNAME

**Note down these exact values!**

### Step 3: Configure DNS in Namecheap

1. Log in to Namecheap: https://www.namecheap.com/myaccount/login/
2. Go to **Domain List** → Click **Manage** next to `blocksage.tech`
3. Go to **Advanced DNS** tab
4. Add a new record:
   - **Type**: CNAME Record
   - **Host**: `cryptorisk`
   - **Value**: (The CNAME value from Vercel - usually `cname.vercel-dns.com.` or similar)
   - **TTL**: Automatic (or 300)
5. Click **Save**

### Step 4: Wait for DNS Propagation

- DNS changes can take 5 minutes to 48 hours to propagate
- Usually takes 15-30 minutes
- You can check status in Vercel dashboard under **Domains**

### Step 5: Verify SSL Certificate

- Vercel automatically provisions SSL certificates
- Once DNS propagates, SSL will be active (usually within a few minutes)

---

## Option 2: Using Vercel CLI

### Step 1: Login to Vercel

```bash
cd "/Users/sagefoster/Desktop/BTC:ETH Corelation analyzer"
./node_modules/.bin/vercel login
```

Follow the prompts to authenticate.

### Step 2: Add Domain

```bash
./node_modules/.bin/vercel domains add cryptorisk.blocksage.tech
```

This will output the DNS records you need to add in Namecheap.

### Step 3: Follow Steps 3-5 from Option 1 above

---

## Troubleshooting

### If domain doesn't work after 30 minutes:

1. **Check DNS propagation**: Use https://dnschecker.org/ to see if DNS has propagated globally
2. **Verify CNAME record**: Make sure the CNAME in Namecheap matches exactly what Vercel provided
3. **Check Vercel dashboard**: Go to Settings → Domains to see if there are any errors
4. **Common issues**:
   - Missing trailing dot in CNAME value (should have `.` at the end)
   - Wrong host value (should be `cryptorisk` not `cryptorisk.blocksage.tech`)
   - DNS not fully propagated yet

### Verify DNS is correct:

```bash
# Check DNS records
dig cryptorisk.blocksage.tech CNAME
# or
nslookup cryptorisk.blocksage.tech
```

---

## Quick Reference

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Namecheap DNS**: https://www.namecheap.com/myaccount/login/ → Domain List → Manage → Advanced DNS
- **DNS Checker**: https://dnschecker.org/

