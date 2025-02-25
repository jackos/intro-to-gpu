---
type: article
title: Systems Programming Primer
description: An introduction to Mojo types and the basics of systems programming
date: 2025-02-24
tag: intro-to-gpu
---

# Systems Programming Primer

## Python Interoperability

If you're coming from a Python background, it will be advantageous to understand how Mojo is different in some key areas. Mojo can interop with a Python interpreter automatically installed by `magic`, this has no performance benefit over Python, but it adds flexibility and is a good way to demonstrate the differences between Mojo and Python.

Let's start by running code through the Python interpreter from Mojo to get a [PythonObject](https://docs.modular.com/mojo/stdlib/python/python_object/PythonObject) back:

```mojo
from python import Python

x = Python.evaluate('5 + 10')
print(x)
```

```text
15
```

`x` is represented in memory the same way as if we ran this in Python:

```python
x = 5 + 10
print(x)
```

```text
15
```

In Python, `x` is actually a pointer to `heap` allocated memory.

::: tip CS Fundamentals
`stack` and `heap` memory are important concepts to understand, [this YouTube video](https://www.youtube.com/watch?v=_8-ht2AKyH4) explains it visually.

If the video doesn't make sense, for now you can use the mental model that:

- `stack` memory is very fast but small, the size of the values are static and can't change at runtime
- `heap` memory is very large and the size can change at runtime, but retrieving the data is relatively slow
- `pointer` is an address to lookup the value somewhere else in memory

Don't be concerned if these concepts don't make sense yet, they will become clear as we go through more examples.
:::

You can access all the Python keywords by importing `builtins`:

```mojo
py = Python.import_module("builtins")

py.print("this uses the python print keyword")
```

```text
this uses the python print keyword
```

We can now use the `type` builtin from Python to see what the dynamic type of `x` is:

```mojo
py.print(py.type(x))
```

```text
<class 'int'>
```

We can read the address that is stored in `x` on the `stack` using the Python builtin `id`

```mojo
py.print(py.id(x))
```

```text
123546968785584
```

This is an address pointing to RAM which is storing a C object from Python, and Mojo behaves the same when using a `PythonObject`, accessing the value uses the address to lookup the data on the `heap` which comes with a performance cost.

This is a simplified representation of how the `C Object` being pointed to would look if it were a Python dict:

```python :skip
heap = {
    44601345678945: {
        "type": "int",
        "ref_count": 1,
        "size": 1,
        "digit": 8,
        #...
    }
    #...
}
```

On the stack the simplified representation of `x` would look like this:

```python :skip
stack = [
    { "frame": "main", "variables": { "x": 44601345678945 } }
]
```

`x` contains an address that is pointing to the heap object

In Python we can change the type dynamically:

```python
x = "mojo"
```

The object in C will change its representation:

```python :skip
heap = {
    44601345678945 : {
        "type": "string",
        "ref_count": 1,
        "size": 4,
        "ascii": True,
        # utf-8 / ascii for "mojo"
        "value": [109, 111, 106, 111]
        # ...
    }
}
```

Mojo also allows us to do this when the type is a `PythonObject`, it works the exact same way as it would in a Python program.

This allows the Python runtime to grant us some nice conveniences:

- Once the `ref_count` goes to zero it will be de-allocated from the heap during garbage collection, so the OS can use that memory for something else.
- An integer can grow beyond 64 bits by increasing `size`.
- We can dynamically change the `type`.
- The data can be large or small, we don't have to think about when we should allocate to the heap.

However this also comes with a penalty, there is a lot of extra memory being used for the extra fields, and it takes CPU instructions to allocate the data, retrieve it, garbage collect etc.

In Mojo we can remove all that overhead:

## Mojo 🔥

```mojo
x = 5 + 10
print(x)
```

```text
15
```

We've just unlocked our first Mojo optimization! Instead of looking up an object on the heap via an address, `x` is now just a value on the stack with 64 bits that can be passed through registers.

This has numerous performance implications:

- All the expensive allocation, garbage collection, and indirection is no longer required
- Compiler optimizations are unlocked as it knows what the concrete type is
- The value can be passed through registers for very fast mathematical operations
- There is no overhead associated with compiling to bytecode and running through an interpreter
- The data can be packed into a SIMD vector for very large performance gains

That last one is very important in today's world, let's see how Mojo gives us the power to take advantage of modern hardware.

## SIMD

SIMD stands for `Single Instruction, Multiple Data`, hardware now contains special registers that allow you to do the same operation across a vector in a single instruction, greatly improving performance, let's take a look:

```mojo
y = SIMD[DType.uint8, 4](1, 2, 3, 4)
print(y)
```

```text
[1, 2, 3, 4]
```

In Mojo the values in square `[]` brackets are known as `parameters`: `[DType.uint8, 4]`. This means they must be compile-time known, while `(1, 2, 3, 4)` are `arguments` which can be compile-time or runtime known.

For example user input or data retrieved from an API is runtime known, and so can't be used as a `parameter` during the compilation process.

In other languages `argument` and `parameter` often mean the same thing, in Mojo it's a very important distinction.

This is now a vector of 8 bit numbers that are packed into 32 bits, we can perform a single instruction across all of it instead of 4 separate instructions:

```mojo
y *= 10
print(y)
```

```text
[10, 20, 30, 40]
```

::: tip CS Fundamentals
Binary is how your computer stores memory, with each bit representing a `0` or `1`. Memory is typically `byte` addressable, meaning that each unique memory address points to one `byte`, which consists of 8 `bits`.

This is how the first 4 digits in a `uint8` are represented in hardware:

- 1 == `00000001`
- 2 == `00000010`
- 3 == `00000011`
- 4 == `00000100`

Binary `1` and `0` represents `ON` or `OFF` indicating an electrical charge in the tiny circuits of your computer.

[Check out this video](https://www.youtube.com/watch?v=RrJXLdv1i74) if you want more information on binary.
:::

We're packing the data together with SIMD on the `stack` so it can be passed into a SIMD register like this:

`00000001` `00000010` `00000011` `00000100`

The SIMD registers in modern CPU's are huge, lets see how big it is on this computer:

```mojo
from sys.info import simdbitwidth
print(simdbitwidth())
```

```text
256
```

That means we could pack 32 x 8bit numbers together and perform a calculation on all of it with a single instruction.

You can also initialize SIMD with a single argument:

```mojo
z = SIMD[DType.uint8, 4](1)
print(z)
```

```text
[1, 1, 1, 1]
```

## Scalars

Scalar just means a single value, you'll notice in Mojo all the numerics are SIMD scalars:

```mojo :skip
var x = UInt8(1)
x = "will cause an error"
```

```text
/tmp/main.mojo:3:9: error: cannot implicitly convert 'StringLiteral' value to 'SIMD[uint8, 1]'
    x = "will cause an error"
        ^~~~~~~~~~~~~~~~~~~~~
```

`UInt8` is just an `alias` for `SIMD[DType.uint8, 1]`, you can see all the [numeric SIMD types imported by default here](https://docs.modular.com/mojo/stdlib/builtin/simd):

- Int8
- Int16
- Int32
- Int64
- UInt8
- UInt16
- UInt32
- UInt64
- Float16
- BFloat16
- Float32
- Float64

Also notice when we try and change the type it throws an error, this is because Mojo is `strongly typed`.

If we use existing Python modules, it will give us back a `PythonObject` that behaves the same `loosely typed` way as it does in Python:

```mojo
np = Python.import_module("numpy")

arr = np.ones([4])
print(arr)
arr = "this will work fine"
print(arr)
```

```text
[1. 1. 1. 1.]
this will work fine
```

## Strings

In Mojo a `String` is heap allocated:

```mojo
s = String("Mojo🔥")
print(s)
```

```text
Mojo🔥
```

`String` contains a pointer to `heap` allocated data, this means we can load a huge amount of data into it limited only by your free RAM, and change the size of the data dynamically during runtime.

Let's cause a type error so you can see the data type underlying the String:

```mojo :skip
var y = s._buffer
x = 20
```

```text
/tmp/main.mojo:59:5: error: invalid redefinition of 'y'
    var y = s._buffer
    ^
/var/folders/z4/syf53w0d243ft3bpzdj55s9w0000gn/T/mdlab/main.mojo:30:5: note: previous definition here
    y = SIMD[DType.uint8, 4](1, 2, 3, 4)
    ^
/Users/jack/.modular/envs/max/bin/mojo: error: failed to parse the provided Mojo source module
```

`List` is similar to a Python List, here it's storing multiple `int8`'s that represent the characters, let's print the first character:

```mojo
print(s[0])
```

```text
M
```

Now lets take a look at the decimal representation:

```mojo
decimal = ord(s[0])
print(decimal)
```

```text
77
```

That's the ASCII code [shown in this table](https://www.ascii-code.com/)

We can build our own string this way, we can put in 78 which is N and 79 which is O

```mojo
var word = List[UInt8]()

word.append(78)
word.append(79)
word.append(0) # Must null terminate the String
```

We can use a `String` to copy the data to another location in memory, and it can now use the data as a String:

```mojo
var word_str = String(buffer=word)
print(word_str)
```

```text
NO
```

Because it points to a different location in `heap` memory, changing the original vector won't change the value retrieved by the reference:

```mojo
word[1] = 78
print(word_str)
```

```text
NO
```

There is also a `StringLiteral` type, it's written directly into the binary, when the program starts it's loaded into `read-only` memory, which means it's constant and lives for the duration of the program:

```mojo
var literal = "This is my StringLiteral"
print(literal)
```

```text
This is my StringLiteral
```

Force an error to see the type:

```mojo :skip
literal = 20
print(literal)
```

```text
/var/folders/z4/syf53w0d243ft3bpzdj55s9w0000gn/T/mdlab/main.mojo:87:15: error: cannot implicitly convert 'IntLiteral' value to 'StringLiteral'
    literal = 20
              ^~
/Users/jack/.modular/envs/max/bin/mojo: error: failed to parse the provided Mojo source module
```

One thing to be aware of is that an emoji is actually four bytes, so we need a slice of 4 to have it print correctly:

```mojo
emoji = String("🔥😀")
print("fire:", emoji[0:4])
print("smiley:", emoji[4:8])
```

```text
fire: 🔥
smiley: 😀
```

## Exercises

1. Use the Python interpreter to calculate 2 to the power of 8 in a `PythonObject` and print it
2. Using the Python `math` module, return `pi` to Mojo and print it
3. Initialize two single floats with 64 bits of data and the value 2.0, using the full SIMD version, and the shortened alias version, then multiply them together and print the result.
4. Create a loop using SIMD that prints four rows of data that looks like this:

```plaintext
[1, 0, 0, 0]
[0, 1, 0, 0]
[0, 0, 1, 0]
[0, 0, 0, 1]
```

In Mojo you can create a loop like this:

```mojo
for i in range(4):
    pass
```

## Solutions

### Exercise 1

```mojo
var pow = Python.evaluate("2 ** 8")
pow
```

```text
256
```

### Exercise 2

```mojo
var math = Python.import_module("math")

var pi = math.pi
pi
```

```text
3.141592653589793
```

### Exercise 3

```mojo
var left = Float64(2.0)
var right = SIMD[DType.float64, 1](2.0)

var res = left * right
res
```

```text
4.0
```

### Exercise 4

```mojo
for i in range(4):
    simd = SIMD[DType.uint8, 4](0)
    simd[i] = 1
    print(simd)
```

```text
[1, 0, 0, 0]
[0, 1, 0, 0]
[0, 0, 1, 0]
[0, 0, 0, 1]
```