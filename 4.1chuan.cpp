#include<iostream>
#include<cstring>
#define MAXLEN 255
using namespace std;
class MyString{
private:
    char* ch;
    int m_len;
public:
    MyString(const char* str=nullptr){
        if(str==nullptr){
            m_len=0;
            ch=new char[1];
            ch[0]='\0';
        }
        else{
            m_len=strlen(str);
            ch=new char[m_len+1];
            strcpy(ch,str);
        }
    }
    ~MyString() {
        if (ch != nullptr) {
            delete[] ch; // 把地盘还给系统
            ch = nullptr; // 良好的习惯：指针抹黑，防止变野指针
            cout << "[析构] 内存已释放" << endl;
        }
    }


};
int main(){
    return 0;
}