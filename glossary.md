# Glossary

## Kernel

In the context of GPUs, a `kernel` is a function that is executed by each thread in parallel.

## Argument

A value that you pass to a function when calling it, or the identifier in the function definition:

```mojo
fn foo(argument: Int):
    pass
```

## Parameter

Not to be confused with [argument](#argument), these go in the `[]` brackets in a method or function definition. Everything inside these brackets must be known at compile time:

```mojo
fn foo2[parameter: Int](argument: Int):
    pass
```

Types are values in Mojo, and you can infer parameters from arguments:

```mojo
from sys.intrinsics import _type_is_eq

fn print_type[Type: AnyType](argument: Type):
    @parameter
    if _type_is_eq[Type, Int]():
        print("parameter is an Int")
    else:
        print("parameter is not an Int")

print_type(Int(10))
print_type(Float64(10.0))
```

```text
parameter is an Int
parameter is not an Int
```

## @parameter if

The `@parameter` decorator over an `if` statement runs during compilation, only the branch that runs will be included in the binary:

```mojo
from sys.info import os_is_linux

@parameter
if os_is_linux():
    print("this will be included in the binary")
else:
    print("this will be eliminated from compilation process")
```

```text
this will be included in the binary
```

## @parameter for

The `@parameter` decorator over a `for` unrolls the loop, which can improve performance and will allow the value to be used as a compile time parameter:

```mojo
@parameter
for i in range(3): # the value inside `range()` must be known at compile time
    alias x = i * 2
    print("evaluated at compile time: ", x)
```

```text
evaluated at compile time:  0
evaluated at compile time:  2
evaluated at compile time:  4
```

## @parameter function

The `@parameter` decorator over a function allows a closure to capture values and be passed in the parameter slot, which passes along the parameters of the captured values:

```mojo
from memory import UnsafePointer

fn fill_pointer[closure: fn(Int) capturing -> None](N: Int):
    for i in range(N):
        closure(i)

fn main():
    alias N = 4
    var pointer = UnsafePointer[Int].alloc(N)

    @parameter
    fn closure(i: Int):
        pointer[i] = i * 2

    fill_pointer[closure](N)
    for i in range(N):
        print(pointer[i])
```

```text
0
2
4
6
```

## register_passable

You can decorate a type with `@register_passable` to indicate it's not `memory only`, for example a `UInt32` is just 32 bits for the actual value and can be directly copied into and out of registers, while a `String` contains an address that requires indirection to access the data so it's `memory only`.

Create a type with a pair of `UInt32` and mark it register passable:

```mojo
@register_passable
struct Pair:
    var a: Int
    var b: Int

    fn __init__(out self, a: Int, b: Int):
        self.a = a
        self.b = b

    fn __copyinit__(out self, other: Self):
        self.a = other.a
        self.b = other.b

    fn __del__(owned self):
        print("dropping")
```

`__copyinit__` and `__del__` aren't required, this is just to indicate that you can define how it copies if you like, and do something special when the object is dropped:

```mojo
var pair = Pair(5, 10)
var pair_copy = pair
pair_copy.a = 10
pair_copy.b = 20

print(pair.a, pair.b)
print(pair_copy.a, pair_copy.b)
```

```text
5 10
dropping
10 20
dropping
```

Generally you just want to mark it with the `@value` decorator, which will give you everything you need for `value-semantics`:

```mojo
@value
@register_passable
struct Pair2:
    var a: Int
    var b: Int

var pair2 = Pair2(5, 10)
print(pair2.a, pair2.b)
```

```text
5 10
```

Trying to define `__moveinit__` will result in an error, the whole idea behind `register_passable` is that the type is moveable into or out of a register without any indirection:

```mojo :skip
@register_passable
struct Pair3:
    var a: Int
    var b: Int

    fn __moveinit__(out self, owned exisiting: Self):
        self.a = exisiting.a
        self.b = existing.b
```

```text
/tmp/mdlab/main.mojo:52:8: error: '@register_passable' types may not have a '__moveinit__' method, they are always movable by copying a register
    fn __moveinit__(out self, owned exisiting: Self):
       ^
mojo: error: failed to parse the provided Mojo source module
```

## trivial

For a trivial type you can't define `__init__`, `__copyinit__`, `__moveinit__`, `__del__`, moving is `trivial` because it always moves by copy, there is no special logic required for indirection or anything else.

Examples of trivial types:

- Arithmetic types such as `Int`, `Bool`, `Float64` etc.
- Pointers
- Arrays of other trivial types including SIMD
- Struct containing only other trivial types decorated with `@register_passable("trivial")`:

```mojo
@value
@register_passable("trivial")
struct Pair4:
    var a: Int
    var b: Int

var pair4 = Pair4(1, 2)
print(pair4.a, pair4.b)
```

```text
1 2
```