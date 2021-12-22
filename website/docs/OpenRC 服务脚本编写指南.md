本文是《OpenRC Service Script Writing Guide》一文的中文翻译。

:::info

- 翻译状态：校对润色中
- 最后修改日期：2021-12-22
- [本文编辑历史](https://github.com/fenprace/openrc-docs-zh-hans/commits/master/OpenRC%20%E6%9C%8D%E5%8A%A1%E8%84%9A%E6%9C%AC%E7%BC%96%E5%86%99%E6%8C%87%E5%8D%97.md)
- [翻译时的原文](https://github.com/OpenRC/openrc/blob/32aeb7407bf5cdc354694b73f4c36376922f7c05/service-script-guide.md)
- [原文最新状态](https://github.com/OpenRC/openrc/blob/master/service-script-guide.md)
- [原文编辑历史](https://github.com/OpenRC/openrc/commits/master/service-script-guide.md)

:::

本文档的目标读者，是为了自己的项目或维护的软件包，而编写 OpenRC 服务脚本的开发者或打包者们。本文包含了各种建议、意见、提示、技巧、原则、警告和注意事项等。

本文旨在指出一些在实际编写 OpenRC 服务脚本中常见的错误，提供替代方案，以防止这些错误发生。每一个你应该做的要点，或不该做的错事，都有对应的章节。我们不考虑那些旁门左道，并假设你使用 start-stop-daemon 来管理一个典型的，长期运行的 UNIX 进程。

## 服务脚本格式

服务脚本都是 shell 脚本。出于可移植性考量，OpenRC 只使用标准的 POSIX sh 子集。默认的解释器（可以于构建 OpenRC 时调整）是 `/bin/sh`，所以使用 mksh 之类的解释器不会有问题。

OpenRC 已经于 busybox sh、ash、dash、bash、mksh、zsh 和其他的 shell 环境下测试。由于 busybox sh 使用内置功能替换了一些指令，但不提供等价的功能，使用 busybox sh 会带来一些困难。

服务脚本的解释器是 `#!/sbin/openrc-run`。不使用这个解释器会破坏依赖，OpenRC 不支持这种做法（换句话说，如果你坚持使用 `#!/bin/sh`，后果自负）。

`depend` 函数声明了服务脚本的依赖。所有脚本必须包含 start/stop/status 函数。OpenRC 提供了默认的 start/stop/status 函数，除非你有非常正当的原因，你都应该使用默认的 start/stop/status 函数。

可以简单地添加额外函数：

```bash
extra_commands="checkconfig"
checkconfig() {
  doSomething
}
```

这段代码导出了 checkconfig 函数，执行 `/etc/init.d/someservice checkconfig` 就会运行这个函数。

在 `extra_commands` 里定义的函数永远都可以使用，而在 `extra_started_commands` 里定义函数只能在服务启动后使用，在 `extra_stopped_commands` 里定义的函数只能在服务停止时使用。可以用这种方式实现优雅的重载服务或类似功能。

编写 restart 函数不会起作用，这是 OpenRC 的一个设计决策，因为重启服务可能会涉及依赖项的重启（比如 network -> apache）。restart 被映射为 `stop()` + `start()`（再加上处理依赖）。如果服务需要在重启时，做一些与正常启动或停止服务所不同的操作，应该测试 `$RC_CMD` 变量，比如：

```bash
[ "$RC_CMD" = restart ] && do_something
```

## depend 函数

这个函数声明了服务脚本的依赖，这将决定服务脚本启动的顺序。

```bash
depend() {
  need net
  use dns logger netmount
  want coolservice
}
```

`need` 声明了强依赖——net 总是需要在这个服务之前启动。

`use` 是一个软依赖——如果 dns、logger 或 netmount 在当前运行级别，在启动这个服务之前，先启动它们；但如果它们不在当前运行级别，就不管它们。

`want` 介于 need 和 use 之间——如果系统里安装了 coolservice，不管它是否在当前运行级别中，都尝试启动它，但我们不在乎它是否成功启动了。

`before` 声明本服务需要在一个服务之前启动。

`after` 声明本服务需要在另一个服务之后启动，但不创建依赖（所以服务停止是独立的）。

`provide` 允许多个服务提供同一个服务类型，比如：所有 cron 守护程序都定义了 `provide cron`，所以启动其中的一个就可以满足 cron 依赖。

`keyword` 允许服务在特定平台下改变行为，比如 `keyword -lxc` 可以让一个服务在 lxc 容器里无效化。这对于键盘映射或模块加载一类的服务很有用，因为这类服务要么是平台特定的，要么在容器或虚拟机等坏境下不可用。

## 默认函数

所有服务脚本都需要包含以下函数：

```bash
start()
stop()
status()
```

OpenRC 提供了以上函数的默认实现，在 `lib/rc/sh/openrc-run.sh`——这样就可以写出十分精简的服务脚本。你可以在每个服务脚本中，按需求覆盖这些函数。

这些默认函数要求服务脚本中，必须有以下变量：

```bash
command=
command_args=
pidfile=
```

所以“最小”的服务脚本可以在 6 行内写下。

## 不要编写你自己的 start/stop 函数

基于你提供的信息，OpenRC 有能力启动或停止大多数守护进程。一个合格的守护进程应该可以默默地在后台运行，并创建自己的 PID 文件。对于这样的守护进程，你可能只需要提供这些变量给 OpenRC：

- command
- command_args
- pidfile

这些信息足够让 OpenRC 独立启动和停止守护进程了。下面这个例子来自 [OpenNTPD](https://www.openntpd.org) 的服务脚本：

```bash
command="/usr/sbin/ntpd"

# 这个特别的 RC_SVCNAME 变量包含了该服务的名称。
pidfile="/run/${RC_SVCNAME}.pid"
command_args="-p ${pidfile}"
```

如果守护进程默认在前台运行，但提供了使它后台运行并创建 PID 文件的选项，那么你还需要：

- command_args_background

这个变量应该包含让你的守护进程后台运行并创建 PID 文件的选项，下面的片段来自 [NRPE](https://github.com/NagiosEnterprises/nrpe) 的服务脚本：

```bash
command="/usr/bin/nrpe"
command_args="--config=/etc/nagios/nrpe.cfg"
command_args_background="--daemon"
pidfile="/run/${RC_SVCNAME}.pid"
```

因为 NRPE 默认以 _root_ 身份运行，不需要额外的授权就可以写入 `/run/nrpe.pid`。OpenRC 会以合适的参数启动和停止进程，甚至会在启动进程时传入 `--daemon` 选项让 NRPE 进入后台运行（NPRE 知道怎么创建自己的 PID 文件）。

但要是你的守护进程不是那么合格呢？要是它不会在后台运行，或者不会创建 PID 文件呢？如果它两者都做不到，就用：

- command_background=true

这会额外传递一个 `--make-pidfile` 选项给 start-stop-daemon，让 start-stop-daemon 为你创建 `$pidfile`（而不是把创建 PID 文件的任务交给守护进程）。

如果你的守护进程无法改变自身的用户或用户组，你可以告诉 start-stop-daemon 以非特权用户启动进程：

- command_user="user:group"

最后，如果你的守护进程可以启动到后台，但是无法创建 PID 文件，那你唯一的选择就是使用：

- procname

OpenRC 会利用 `procname`，通过比较运行中进程的名字，来查找你的守护进程，这样做并不是很可靠。不过你的守护进程本来就不应该只后台运行，而不创建 PID 文件。下面的例子是 [CA NetConsole Daemon](https://oss.oracle.com/) 服务脚本的一部分：

```bash
command="/usr/sbin/cancd"
command_args="-p ${CANCD_PORT}
              -l ${CANCD_LOG_DIR}
              -o ${CANCD_LOG_FORMAT}"
command_user="cancd"

# cancd 将自身守护进程化，但不创建 PID 文件，也不提供在前台运行的选项
# 所以在终止进程时，我们能做的，最多就是尝试以进程名称查找进程来终止它
procname="cancd"
```

回顾一下：

1. 如果进程在后台运行，并创建自己的 PID 文件，用 `pidfile`。
2. 如果进程不在后台运行（或者提供了让它在前台运行的选项），并且不创建 PID 文件，那就用 `command_background=true` 和 `pidfile`。
3. 如果进程在后台运行，但是不创建 PID 文件，用 `procname` 代替 `pidfile`，但如果你的进程提供了让它在前台运行的选项，那你应该让它在前台运行（然后按照上一点的方法处理它）。
4. 最后一种情况，尽管这样做没什么意义，你的进程不在后台运行但创建了 PID 文件。你应该禁用或无效化该进程的 PID 文件（或者把 PID 文件写入一个无用的路径），然后用 `command_background=true`。

## 重载守护进程的配置

许多守护进程都会响应信号来重载配置。假设你的进程接收到 `SIGHUP` 就重载配置，可以增加一个“reload”命令，来让你的服务脚本具有重载配置功能。首先，在服务脚本里声明这个命令。

```bash
extra_started_commands="reload"
```

我们用 `extra_started_commands` 而不是 `extra_commands`，因为“reload”只在进程运行时（也就是启动后）有效。现在可以用 start-stop-daemon 发送信号到对应的进程（假设你已经在服务脚本里定义了 `pidfile`）：

```bash
reload() {
  ebegin "Reloading ${RC_SVCNAME}"
  start-stop-daemon --signal HUP --pidfile "${pidfile}"
  eend $?
}
```

## 不要在配置损坏时重启 / 重载

这是一个十分常见的情景：用户启动了守护进程，修改配置文件，然后再尝试重启进程。如果修改后的配置文件有错误，会导致进程停止后不能再次启动（由于配置文件错误）。编写一个检查配置文件的函数，配合 `start_pre` 和 `stop_pre` 钩子，就可以预防这种情况发生。

```bash
checkconfig() {
  # 检查配置文件
}

start_pre() {
  # 如果不是重启，在启动进程前检查配置文件的有效性（相比盲目的启动进程，
  # 这样可以生成更好的错误信息）
  #
  # 反之，如果这 *是* 一次重启，那么 stop_pre 函数会确保配置文件可用，
  # 我们没必要再检查一遍。
  if [ "${RC_CMD}" != "restart" ] ; then
    checkconfig || return $?
  fi
}

stop_pre() {
  # 如果是重启，在停止进程前检查配置文件的有效性。
  if [ "${RC_CMD}" = "restart" ] ; then
      checkconfig || return $?
  fi
}
```

要防止 _重载_ 损坏的配置文件，很简单：

```bash
reload() {
  checkconfig || return $?
  ebegin "Reloading ${RC_SVCNAME}"
  start-stop-daemon --signal HUP --pidfile "${pidfile}"
  eend $?
}
```

## 只有 root 用户可以写入 PID 文件

只能有 _root_ 一个用户可以写入 PID 文件，也就是说，PID 文件所在的文件夹拥有者必须是 _root_。在 Linux 中，这个文件夹一般是 /run，在其他操作系统中一般是 /var/run。

一些守护进程以非特权用户运行，然后（以非特权用户）在 `/var/run/foo/foo.pid` 之类的路径下创建自己的 PID 文件。这使得非特权用户能够杀死 _root_ 进程，因为服务停止时，_root_ 一般会向 PID 文件（该状况下，这个文件由非特权用户控制）的内容发送一个 SIGTERM 信号。该问题的预兆之一，是用 `checkpath` 来设置 PID 文件所在目录的所有权，比如：

```bash
# 别这么做 别这么做 别这么做 别这么做
start_pre() {
  # 确保 pidfile 所在的目录可以被 foo 用户 / 用户组写入
  checkpath --directory --mode 0700 --owner foo:foo "/var/run/foo"
}
# 别这么做 别这么做 别这么做 别这么做
```

如果 _foo_ 用户拥有 `/var/run/foo`，那么它可以随心所欲地修改 `/var/run/foo/foo.pid` 文件。即使 _root_ 拥有 PID 文件，_foo_ 用户还是可以删除 _root_ 所拥有的 PID 文件，再创建一个属于 _foo_ 的文件取而代之。要避免安全问题，PID 文件必须由 _root_ 创建，且必须在 _root_ 拥有的文件夹中。如果你的守护进程负责 fork 到后台并创建 PID 文件，PID 文件却由非特权运行时用户所拥有，那么有可能是上游的问题。

只要作为 _root_ 创建了 PID 文件（在放弃特权前），就可以直接把它写入 _root_ 拥有的目录中去。比如，_foo_ 守护进程想要写入 `/var/run/foo.pid`，不需要 checkpath。注意：技术上，只要 _root_ 拥有 PID 文件和 PID 文件所在的目录，完全可以使用类似于 `/var/run/foo/foo.pid` 的目录结构。

理想情况下（参考[把服务脚本放到上游](#致打包者把服务脚本放到上游)），上游应该集成你的服务脚本，合适的 PID 文件目录应该由构建系统，例如：

```bash
pidfile="@piddir@/${RC_SVCNAME}.pid"
```

正面例子之一是这个 [Nagios 核心服务脚本](https://github.com/NagiosEnterprises/nagioscore/blob/master/openrc-init.in)，在构建时指定了 PID 文件的完整路径。

## 不要让用户控制 PID 文件的位置

允许末端用户通过 conf.d 变量控制 PID 文件的位置是一个常见错误，原因有以下几点：

1. PID 文件由用户控制时，你需要确保 PID 文件的父目录存在并且可以写入，为你的服务脚本增加了不必要的代码。
2. 如果 PID 文件的路径在服务运行时改变了，你会发现你没法停止进程。
3. 包含 PID 文件的目录最好由上游构建系统决定（参考[把服务脚本放到上游](#致打包者把服务脚本放到上游)）。Linux 当下流行的趋势把 PID 文件放在 `/run`，尽管其他操作系统依然使用 `/var/run`。最好是在 `./configure` 脚本中配置你 PID 文件的路径。
4. 其实反正也没人在乎 PID 文件的位置。

因为 OpenRC 服务名称不能重名：

```bash
pidfile="/var/run/${RC_SVCNAME}.pid"
```

这样就可以保证你的 PID 文件不会重名。

## （致打包者）把服务脚本放到上游

**上游**是分发 OpenRC 服务脚本的理想位置。与 systemd 服务类似，一个配置良好的 OpenRC 服务脚本应该是发行版不可知的，且最好配置在上游。为何？有两个原因：第一，在上游意味着对该服务脚本的所有修改与改进，都有一个权威的来源。第二，每个服务脚本都有一些路径依赖传递进构建系统的参数，比如：

```bash
command=/usr/bin/foo
```

在基于 autotools 的构建系统中，其实应该写成：

```bash
command=@bindir@/foo
```

这样就可以根据用户传入的 `--bindir`，改变 command 变量的值。如果你在自己发行版的仓库中配置服务脚本，你就得自己保持 command 路径与软件包同步，这可不好玩。

## 小心“need net”依赖

关于“need net”依赖，你需要知道两件事：

1. 回环（loopback）接口不满足“need net”，所以你必须开启 _其他的_ 接口。
2. 取决于 `rc.conf` 中 `rc_depend_strict` 的值，要满足“need net” ，可以是开启 _任何一个_ 非回环接口，也可以是开启 _所有_ 非回环接口。

第一点说明对于只需要绑定 `0.0.0.0` 的守护进程来说，设定“need net”是错误的；第二点说明对于依赖某个特定接口（比如 WAN 接口）的守护进程来说，设定“need net”也是不对的。我们讨论两种最常见的，需要使用“need net”的场景：需要访问网络资源的客户端，和提供网络资源的服务端。

### 网络客户端

网络客户端通常需要开启 WAN 接口。你很可能会想让你的服务脚本依赖 WAN 接口；但是在这之前，请先问自己一个问题：如果 WAN 接口不可用，会发生什么坏事？换句话说，如果管理员要禁用 WAN，是否应该停止你的服务？这些问题通常的答案都是：“不”，在这种情况下，你应该将“net”依赖完全抛诸脑后。

假设有一个联网更新病毒特征的服务，要正常工作，它需要连接互联网。然而，服务本身并不依赖 WAN 接口。如果 WAN 接口开启，那一切正常；反之如果 WAN 接口关闭，那么最坏的事情也不过是纪录一条“服务器不可用”的警告，病毒特征更新服务本身不会崩溃。而且，更重要的是——即使管理员关闭了 WAN 接口，你也肯定不想终止你的病毒特征更新服务。

### 网络服务端

相较于客户端，服务端通常更好处理。大多是服务端守护进程都默认监听 `0.0.0.0`（也就是所有地址），也因此仅提供回环接口就可以工作。在 OpenRC 中，回环服务位于 `boot` 运行级别中，因此大多数服务端进程不需要额外的网络依赖。

例外之一是那些在 WAN 不可用时，会产生负面效果的守护进程。比如，只要你的监控的主机无法访问，Nagios 服务器进程就会生成“天要塌了”警报。所以这种情况你的服务脚本应该要求某个接口（通常是 WAN）可用。“need”依赖是比较恰当的选择，因为你会想要在关闭网络前，先停止 Nagios 程序。

如果你的守护进程可以只监听某个特定的接口，请参考[依赖特定接口](#依赖特定接口)一节。

### 依赖特定接口

即使你要依赖一个特定的接口，要程序化的识别、选择接口通常也很困难。例如，假设你的 _sshd_ 守护进程监听 `192.168.1.100`（而不是正常的 `0.0.0.0`），那么你将面临两个问题：

1. 解析 `sshd_config`，找出被监听的 IP；然后
2. 确定 `192.168.1.100` 的接口对应的网络服务名称。

在服务脚本里解析配置文件一般都不是好主意，但是第二个问题更加困难。与之相反，最可靠的（也是最懒惰的）方法是让用户在修改 sshd_config 时指定依赖。在服务配置文件中增加：

```bash
# 根据你配置文件中的“bind”设置指定网络服务。比如你的绑定了 127.0.0.1，
# 那这里应该设置成对应回环接口的“loopback”
rc_need="loopback"
```

对于绑定 `0.0.0.0`的守护进程来说，这样的默认配置十分合理，同时还允许用户按需指定接口，比如`rc_need="net.wan"`。让用户负责在修改进程配置文件时，选择合适的服务依赖。
